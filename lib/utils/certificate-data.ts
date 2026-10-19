import { db } from "@/lib/db";
import {
  enrollments,
  students,
  courses,
  courseIntakes,
  certificates,
  certificateRequestItems,
  certificateRequests,
  officialSignatures,
} from "@/lib/db/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { isPassingGrade } from "@/lib/utils/grades";
import type { Grade } from "@/lib/db/schema";

export interface CertificateSignatory {
  fullName: string | null;
  rankTitle: string | null;
  signatureImagePath: string | null;
}

export interface CertificateData {
  enrollmentId: number;
  certificateNumber: string;
  armyNumber: string;
  rankAtEnrollment: string;
  fullName: string;
  courseName: string;
  courseCode: string;
  intakeNumber: string;
  startDate: string;
  endDate: string | null;
  schoolNameSw: string;
  schoolNameEn: string;
  chiefInstructor: CertificateSignatory;
  commandant: CertificateSignatory;
  /** Calendar day (YYYY-MM-DD, Tanzania time) the Chief Instructor approved. */
  chiefInstructorSignedOn: string | null;
  /** Calendar day (YYYY-MM-DD, Tanzania time) the Commandant approved. */
  commandantSignedOn: string | null;
  issueDate: Date;
}

const SIGNING_TIME_ZONE = "Africa/Dar_es_Salaam";

function signingDay(value: Date | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SIGNING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

/**
 * Approval dates of the print request the certificate comes from. With no
 * requestId, the enrollment's most recent fully approved request is used.
 */
async function getSigningDays(
  enrollmentId: number,
  requestId?: number
): Promise<{ chiefInstructor: string | null; commandant: string | null }> {
  const [row] = await db
    .select({
      chiefInstructorApprovedAt: certificateRequests.chiefInstructorApprovedAt,
      commandantApprovedAt: certificateRequests.commandantApprovedAt,
    })
    .from(certificateRequestItems)
    .innerJoin(
      certificateRequests,
      eq(certificateRequestItems.requestId, certificateRequests.id)
    )
    .where(
      and(
        eq(certificateRequestItems.enrollmentId, enrollmentId),
        requestId === undefined
          ? isNotNull(certificateRequests.commandantApprovedAt)
          : eq(certificateRequests.id, requestId)
      )
    )
    .orderBy(desc(certificateRequests.commandantApprovedAt))
    .limit(1);

  return {
    chiefInstructor: signingDay(row?.chiefInstructorApprovedAt ?? null),
    commandant: signingDay(row?.commandantApprovedAt ?? null),
  };
}

const SCHOOL_NAME_SW = "Shule ya Mafunzo ya Mizinga";
const SCHOOL_NAME_EN = "School of Field Artillery";

export function isEligibleForCertificate(
  status: string,
  grade: string | null,
  averageMarks: string | null,
  passingMark: number
): { eligible: boolean; reason?: string } {
  if (status === "indiscipline" || status === "incomplete" || status === "withdrawn") {
    return {
      eligible: false,
      reason: `Cannot issue certificate for enrollment status: ${status.replace(/_/g, " ")}.`,
    };
  }

  if (status === "failed" || grade === "F" || grade === "D") {
    return {
      eligible: false,
      reason: "Student did not pass the course (failed).",
    };
  }

  if (status !== "completed" && status !== "in_progress" && status !== "enrolled") {
    // Allow completed primarily; also allow if they have passing grade while still enrolled (edge case)
  }

  if (grade && isPassingGrade(grade as Grade)) {
    return { eligible: true };
  }

  if (averageMarks && parseFloat(averageMarks) >= passingMark) {
    return { eligible: true };
  }

  if (status === "completed") {
    return { eligible: true };
  }

  return {
    eligible: false,
    reason:
      "Student must complete the course with a passing grade before a certificate can be issued.",
  };
}

export async function getActiveOfficial(
  role: "chief_instructor" | "commandant"
): Promise<CertificateSignatory | null> {
  const [row] = await db
    .select({
      fullName: officialSignatures.fullName,
      rankTitle: officialSignatures.rankTitle,
      signatureImagePath: officialSignatures.signatureImagePath,
    })
    .from(officialSignatures)
    .where(
      and(
        eq(officialSignatures.role, role),
        eq(officialSignatures.isActive, true)
      )
    )
    .orderBy(desc(officialSignatures.createdAt))
    .limit(1);

  return row ?? null;
}

function buildCertificateNumber(
  courseCode: string,
  intakeNumber: string,
  armyNumber: string
): string {
  const safeIntake = intakeNumber.replace(/\s+/g, "");
  const safeArmy = armyNumber.replace(/\s+/g, "");
  return `CERT-${courseCode}-${safeIntake}-${safeArmy}`;
}

export async function getCertificateData(
  enrollmentId: number,
  requestId?: number
): Promise<
  | { success: true; data: CertificateData }
  | { success: false; error: string }
> {
  const [row] = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      status: enrollments.status,
      grade: enrollments.grade,
      averageMarks: enrollments.averageMarks,
      rankAtEnrollment: enrollments.rankAtEnrollment,
      armyNumber: students.armyNumber,
      fullName: students.fullName,
      courseName: courses.courseName,
      courseCode: courses.courseCode,
      passingMark: courses.passingMark,
      intakeNumber: courseIntakes.intakeNumber,
      startDate: courseIntakes.startDate,
      endDate: courseIntakes.endDate,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(enrollments.enrollmentId, enrollmentId))
    .limit(1);

  if (!row) {
    return { success: false, error: "Enrollment not found." };
  }

  const eligibility = isEligibleForCertificate(
    row.status,
    row.grade,
    row.averageMarks,
    row.passingMark
  );
  if (!eligibility.eligible) {
    return { success: false, error: eligibility.reason ?? "Not eligible." };
  }

  const [existing] = await db
    .select({ certificateNumber: certificates.certificateNumber })
    .from(certificates)
    .where(eq(certificates.enrollmentId, enrollmentId))
    .limit(1);

  const [chiefInstructor, commandant, signedOn] = await Promise.all([
    getActiveOfficial("chief_instructor"),
    getActiveOfficial("commandant"),
    getSigningDays(enrollmentId, requestId),
  ]);

  const certificateNumber =
    existing?.certificateNumber ??
    buildCertificateNumber(row.courseCode, row.intakeNumber, row.armyNumber);

  return {
    success: true,
    data: {
      enrollmentId: row.enrollmentId,
      certificateNumber,
      armyNumber: row.armyNumber,
      rankAtEnrollment: row.rankAtEnrollment,
      fullName: row.fullName,
      courseName: row.courseName,
      courseCode: row.courseCode,
      intakeNumber: row.intakeNumber,
      startDate: row.startDate,
      endDate: row.endDate,
      schoolNameSw: SCHOOL_NAME_SW,
      schoolNameEn: SCHOOL_NAME_EN,
      chiefInstructor: chiefInstructor ?? {
        fullName: null,
        rankTitle: null,
        signatureImagePath: null,
      },
      commandant: commandant ?? {
        fullName: null,
        rankTitle: null,
        signatureImagePath: null,
      },
      chiefInstructorSignedOn: signedOn.chiefInstructor,
      commandantSignedOn: signedOn.commandant,
      issueDate: new Date(),
    },
  };
}

export async function recordCertificateIssue(
  data: CertificateData,
  issuedByUserId: number
) {
  const [existing] = await db
    .select({ certificateId: certificates.certificateId })
    .from(certificates)
    .where(eq(certificates.enrollmentId, data.enrollmentId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(certificates)
    .values({
      enrollmentId: data.enrollmentId,
      certificateNumber: data.certificateNumber,
      chiefInstructorName: data.chiefInstructor.fullName,
      chiefInstructorRank: data.chiefInstructor.rankTitle,
      chiefInstructorSignaturePath: data.chiefInstructor.signatureImagePath,
      commandantName: data.commandant.fullName,
      commandantRank: data.commandant.rankTitle,
      commandantSignaturePath: data.commandant.signatureImagePath,
      issuedBy: issuedByUserId,
    })
    .returning({ certificateId: certificates.certificateId });

  return created;
}
