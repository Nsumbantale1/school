import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  certificateRequests,
  certificateRequestItems,
  certificates,
  courses,
  courseIntakes,
  enrollments,
  students,
} from "@/lib/db/schema";
import { isEligibleForCertificate } from "@/lib/utils/certificate-data";

export const CERT_REQUEST_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_chief_instructor: "Pending Chief Instructor",
  pending_commandant: "Pending Commandant",
  approved: "Approved — ready to print",
  rejected: "Rejected",
  cancelled: "Cancelled",
  issued: "Fully issued",
  partially_issued: "Partially issued",
};

export async function generateCertificateRequestNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CERT-REQ-${year}-`;
  const [row] = await db
    .select({ requestNumber: certificateRequests.requestNumber })
    .from(certificateRequests)
    .where(sql`${certificateRequests.requestNumber} LIKE ${prefix + "%"}`)
    .orderBy(desc(certificateRequests.requestNumber))
    .limit(1);

  let next = 1;
  if (row?.requestNumber) {
    const tail = row.requestNumber.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function enrollmentIsPrintAuthorized(
  enrollmentId: number
): Promise<{ ok: boolean; reason?: string; requestId?: number }> {
  const [issued] = await db
    .select({ certificateId: certificates.certificateId })
    .from(certificates)
    .where(eq(certificates.enrollmentId, enrollmentId))
    .limit(1);
  if (issued) return { ok: true };

  const [item] = await db
    .select({
      requestId: certificateRequestItems.requestId,
      itemStatus: certificateRequestItems.status,
      requestStatus: certificateRequests.status,
    })
    .from(certificateRequestItems)
    .innerJoin(
      certificateRequests,
      eq(certificateRequestItems.requestId, certificateRequests.id)
    )
    .where(
      and(
        eq(certificateRequestItems.enrollmentId, enrollmentId),
        inArray(certificateRequestItems.status, ["pending", "issued"]),
        inArray(certificateRequests.status, [
          "approved",
          "issued",
          "partially_issued",
        ])
      )
    )
    .orderBy(desc(certificateRequests.updatedAt))
    .limit(1);

  if (!item) {
    return {
      ok: false,
      reason:
        "Certificate must be on an approved print request (Chief Instructor + Commandant) before it can be issued.",
    };
  }
  return { ok: true, requestId: item.requestId };
}

export async function listEligibleEnrollmentsForIntake(intakeId: number) {
  const rows = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      status: enrollments.status,
      grade: enrollments.grade,
      averageMarks: enrollments.averageMarks,
      rankAtEnrollment: enrollments.rankAtEnrollment,
      armyNumber: students.armyNumber,
      fullName: students.fullName,
      unit: enrollments.unitAtEnrollment,
      passingMark: courses.passingMark,
      position: enrollments.position,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(enrollments.intakeId, intakeId))
    .orderBy(enrollments.position, students.fullName);

  return rows
    .map((r) => {
      const elig = isEligibleForCertificate(
        r.status,
        r.grade,
        r.averageMarks,
        r.passingMark
      );
      return { ...r, eligible: elig.eligible, reason: elig.reason };
    })
    .filter((r) => r.eligible);
}

export async function getCertificateRequestDetail(requestId: number) {
  const [request] = await db
    .select({
      id: certificateRequests.id,
      requestNumber: certificateRequests.requestNumber,
      status: certificateRequests.status,
      certificateCount: certificateRequests.certificateCount,
      notes: certificateRequests.notes,
      createdBy: certificateRequests.createdBy,
      submittedAt: certificateRequests.submittedAt,
      chiefInstructorApprovedAt: certificateRequests.chiefInstructorApprovedAt,
      commandantApprovedAt: certificateRequests.commandantApprovedAt,
      rejectedAt: certificateRequests.rejectedAt,
      rejectionReason: certificateRequests.rejectionReason,
      rejectedStage: certificateRequests.rejectedStage,
      createdAt: certificateRequests.createdAt,
      updatedAt: certificateRequests.updatedAt,
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
    })
    .from(certificateRequests)
    .innerJoin(courses, eq(certificateRequests.courseId, courses.courseId))
    .innerJoin(
      courseIntakes,
      eq(certificateRequests.intakeId, courseIntakes.intakeId)
    )
    .where(eq(certificateRequests.id, requestId))
    .limit(1);

  if (!request) return null;

  const items = await db
    .select({
      id: certificateRequestItems.id,
      enrollmentId: certificateRequestItems.enrollmentId,
      studentArmyNumber: certificateRequestItems.studentArmyNumber,
      status: certificateRequestItems.status,
      issuedAt: certificateRequestItems.issuedAt,
      certificateId: certificateRequestItems.certificateId,
      fullName: students.fullName,
      rank: enrollments.rankAtEnrollment,
      grade: enrollments.grade,
      averageMarks: enrollments.averageMarks,
      unit: enrollments.unitAtEnrollment,
    })
    .from(certificateRequestItems)
    .innerJoin(
      enrollments,
      eq(certificateRequestItems.enrollmentId, enrollments.enrollmentId)
    )
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .where(
      and(
        eq(certificateRequestItems.requestId, requestId),
        eq(certificateRequestItems.status, "pending")
      )
    )
    .orderBy(students.fullName);

  const issuedItems = await db
    .select({
      id: certificateRequestItems.id,
      enrollmentId: certificateRequestItems.enrollmentId,
      studentArmyNumber: certificateRequestItems.studentArmyNumber,
      status: certificateRequestItems.status,
      issuedAt: certificateRequestItems.issuedAt,
      certificateId: certificateRequestItems.certificateId,
      fullName: students.fullName,
      rank: enrollments.rankAtEnrollment,
      grade: enrollments.grade,
      averageMarks: enrollments.averageMarks,
      unit: enrollments.unitAtEnrollment,
    })
    .from(certificateRequestItems)
    .innerJoin(
      enrollments,
      eq(certificateRequestItems.enrollmentId, enrollments.enrollmentId)
    )
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .where(
      and(
        eq(certificateRequestItems.requestId, requestId),
        eq(certificateRequestItems.status, "issued")
      )
    )
    .orderBy(students.fullName);

  return { request, items: [...items, ...issuedItems] };
}

export async function refreshRequestIssueStatus(requestId: number) {
  const rows = await db
    .select({ status: certificateRequestItems.status })
    .from(certificateRequestItems)
    .where(
      and(
        eq(certificateRequestItems.requestId, requestId),
        inArray(certificateRequestItems.status, ["pending", "issued"])
      )
    );

  const pending = rows.filter((r) => r.status === "pending").length;
  const issued = rows.filter((r) => r.status === "issued").length;
  let status: "approved" | "issued" | "partially_issued" = "approved";
  if (issued > 0 && pending === 0) status = "issued";
  else if (issued > 0 && pending > 0) status = "partially_issued";

  await db
    .update(certificateRequests)
    .set({ status, updatedAt: new Date() })
    .where(eq(certificateRequests.id, requestId));
}
