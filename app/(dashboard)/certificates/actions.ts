"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  certificateRequests,
  certificateRequestItems,
  courseIntakes,
  enrollments,
  courses,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import {
  canApproveCertificateAsChiefInstructor,
  canApproveCertificateAsCommandant,
  canCreateCertificateRequest,
  canPrintApprovedCertificates,
} from "@/lib/auth/permissions";
import { auditCreate, auditUpdate } from "@/lib/utils/audit";
import {
  getCertificateData,
  recordCertificateIssue,
} from "@/lib/utils/certificate-data";
import {
  enrollmentIsPrintAuthorized,
  generateCertificateRequestNumber,
  listEligibleEnrollmentsForIntake,
  refreshRequestIssueStatus,
} from "@/lib/utils/certificate-requests";
import {
  notifyCertificateFullyApproved,
  notifyCertificatePendingChiefInstructor,
  notifyCertificatePendingCommandant,
} from "@/lib/utils/notify";

function revalidateCertPaths(requestId?: number) {
  revalidatePath("/certificates");
  revalidatePath("/certificates/new");
  revalidatePath("/certificates/approvals");
  revalidatePath("/notifications");
  if (requestId) revalidatePath(`/certificates/${requestId}`);
}

async function courseLabelForIntake(intakeId: number): Promise<string> {
  const [row] = await db
    .select({
      courseCode: courses.courseCode,
      intakeNumber: courseIntakes.intakeNumber,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);
  if (!row) return "course";
  return `${row.courseCode} · ${row.intakeNumber}`;
}

export async function createCertificateRequest(input: {
  intakeId: number;
  enrollmentIds: number[];
  notes?: string;
  submit?: boolean;
}) {
  const user = await requireRole(["admin"]);
  if (!canCreateCertificateRequest(user.role)) {
    return { success: false as const, error: "Admin only." };
  }

  const enrollmentIds = [...new Set(input.enrollmentIds)].filter((id) =>
    Number.isFinite(id)
  );
  if (enrollmentIds.length === 0) {
    return {
      success: false as const,
      error: "Select at least one student for certificates.",
    };
  }

  const [intake] = await db
    .select({
      intakeId: courseIntakes.intakeId,
      courseId: courseIntakes.courseId,
    })
    .from(courseIntakes)
    .where(eq(courseIntakes.intakeId, input.intakeId))
    .limit(1);
  if (!intake) return { success: false as const, error: "Intake not found." };

  const eligible = await listEligibleEnrollmentsForIntake(input.intakeId);
  const eligibleSet = new Set(eligible.map((e) => e.enrollmentId));
  const selected = enrollmentIds.filter((id) => eligibleSet.has(id));
  if (selected.length === 0) {
    return {
      success: false as const,
      error: "None of the selected students are eligible for a certificate.",
    };
  }

  const enrollRows = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      armyNumber: enrollments.studentArmyNumber,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.intakeId, input.intakeId),
        inArray(enrollments.enrollmentId, selected)
      )
    );

  const requestNumber = await generateCertificateRequestNumber();
  const submit = input.submit !== false;
  const now = new Date();

  const [created] = await db
    .insert(certificateRequests)
    .values({
      requestNumber,
      courseId: intake.courseId,
      intakeId: intake.intakeId,
      status: submit ? "pending_chief_instructor" : "draft",
      certificateCount: enrollRows.length,
      notes: input.notes?.trim() || null,
      createdBy: user.userId,
      submittedAt: submit ? now : null,
    })
    .returning({ id: certificateRequests.id });

  await db.insert(certificateRequestItems).values(
    enrollRows.map((r) => ({
      requestId: created.id,
      enrollmentId: r.enrollmentId,
      studentArmyNumber: r.armyNumber,
      status: "pending" as const,
    }))
  );

  await auditCreate(user, "certificate_requests", String(created.id), {
    requestNumber,
    certificateCount: enrollRows.length,
    status: submit ? "pending_chief_instructor" : "draft",
  });

  if (submit) {
    const label = await courseLabelForIntake(intake.intakeId);
    await notifyCertificatePendingChiefInstructor({
      requestId: created.id,
      requestNumber,
      courseLabel: label,
      certificateCount: enrollRows.length,
    });
  }

  revalidateCertPaths(created.id);
  return {
    success: true as const,
    requestId: created.id,
    requestNumber,
    certificateCount: enrollRows.length,
  };
}

export async function reviseCertificateRequest(input: {
  requestId: number;
  enrollmentIds: number[];
  notes?: string;
  resubmit?: boolean;
}) {
  const user = await requireRole(["admin"]);
  const [req] = await db
    .select()
    .from(certificateRequests)
    .where(eq(certificateRequests.id, input.requestId))
    .limit(1);

  if (!req) return { success: false as const, error: "Request not found." };
  if (req.status !== "rejected" && req.status !== "draft") {
    return {
      success: false as const,
      error: "Only draft or rejected requests can be revised.",
    };
  }

  const enrollmentIds = [...new Set(input.enrollmentIds)].filter((id) =>
    Number.isFinite(id)
  );
  if (enrollmentIds.length === 0) {
    return {
      success: false as const,
      error: "Select at least one student.",
    };
  }

  const eligible = await listEligibleEnrollmentsForIntake(req.intakeId);
  const eligibleSet = new Set(eligible.map((e) => e.enrollmentId));
  const selected = enrollmentIds.filter((id) => eligibleSet.has(id));
  if (selected.length === 0) {
    return { success: false as const, error: "No eligible students selected." };
  }

  const enrollRows = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      armyNumber: enrollments.studentArmyNumber,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.intakeId, req.intakeId),
        inArray(enrollments.enrollmentId, selected)
      )
    );

  await db
    .delete(certificateRequestItems)
    .where(eq(certificateRequestItems.requestId, req.id));

  await db.insert(certificateRequestItems).values(
    enrollRows.map((r) => ({
      requestId: req.id,
      enrollmentId: r.enrollmentId,
      studentArmyNumber: r.armyNumber,
      status: "pending" as const,
    }))
  );

  const resubmit = input.resubmit !== false;
  const now = new Date();
  await db
    .update(certificateRequests)
    .set({
      certificateCount: enrollRows.length,
      notes: input.notes?.trim() || null,
      status: resubmit ? "pending_chief_instructor" : "draft",
      submittedAt: resubmit ? now : null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      rejectedStage: null,
      chiefInstructorApprovedBy: null,
      chiefInstructorApprovedAt: null,
      commandantApprovedBy: null,
      commandantApprovedAt: null,
      updatedAt: now,
    })
    .where(eq(certificateRequests.id, req.id));

  await auditUpdate(
    user,
    "certificate_requests",
    String(req.id),
    { status: req.status },
    {
      action: "revise",
      certificateCount: enrollRows.length,
      resubmit,
      status: resubmit ? "pending_chief_instructor" : "draft",
    }
  );

  if (resubmit) {
    const label = await courseLabelForIntake(req.intakeId);
    await notifyCertificatePendingChiefInstructor({
      requestId: req.id,
      requestNumber: req.requestNumber,
      courseLabel: label,
      certificateCount: enrollRows.length,
    });
  }

  revalidateCertPaths(req.id);
  return {
    success: true as const,
    requestId: req.id,
    certificateCount: enrollRows.length,
  };
}

export async function submitCertificateRequest(requestId: number) {
  const user = await requireRole(["admin"]);
  const [req] = await db
    .select()
    .from(certificateRequests)
    .where(eq(certificateRequests.id, requestId))
    .limit(1);
  if (!req) return { success: false as const, error: "Request not found." };
  if (req.status !== "draft" && req.status !== "rejected") {
    return { success: false as const, error: "Request is not submittable." };
  }
  if (req.certificateCount < 1) {
    return { success: false as const, error: "Request has no students." };
  }

  await db
    .update(certificateRequests)
    .set({
      status: "pending_chief_instructor",
      submittedAt: new Date(),
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      rejectedStage: null,
      chiefInstructorApprovedBy: null,
      chiefInstructorApprovedAt: null,
      commandantApprovedBy: null,
      commandantApprovedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(certificateRequests.id, requestId));

  await auditUpdate(
    user,
    "certificate_requests",
    String(requestId),
    { status: req.status },
    {
      action: "submit",
      certificateCount: req.certificateCount,
      status: "pending_chief_instructor",
    }
  );

  const label = await courseLabelForIntake(req.intakeId);
  await notifyCertificatePendingChiefInstructor({
    requestId,
    requestNumber: req.requestNumber,
    courseLabel: label,
    certificateCount: req.certificateCount,
  });

  revalidateCertPaths(requestId);
  return { success: true as const };
}

export async function approveCertificateRequest(requestId: number) {
  const user = await requireRole(["chief_instructor", "commandant"]);
  const [req] = await db
    .select()
    .from(certificateRequests)
    .where(eq(certificateRequests.id, requestId))
    .limit(1);
  if (!req) return { success: false as const, error: "Request not found." };

  const now = new Date();

  if (
    req.status === "pending_chief_instructor" &&
    canApproveCertificateAsChiefInstructor(user.role)
  ) {
    await db
      .update(certificateRequests)
      .set({
        status: "pending_commandant",
        chiefInstructorApprovedBy: user.userId,
        chiefInstructorApprovedAt: now,
        updatedAt: now,
      })
      .where(eq(certificateRequests.id, requestId));

    await auditUpdate(
      user,
      "certificate_requests",
      String(requestId),
      { status: req.status },
      {
        action: "approve_chief_instructor",
        certificateCount: req.certificateCount,
        status: "pending_commandant",
      }
    );

    const label = await courseLabelForIntake(req.intakeId);
    await notifyCertificatePendingCommandant({
      requestId,
      requestNumber: req.requestNumber,
      courseLabel: label,
      certificateCount: req.certificateCount,
    });

    revalidateCertPaths(requestId);
    return {
      success: true as const,
      nextStatus: "pending_commandant" as const,
      message: `Approved. Commandant notified — ${req.certificateCount} certificate(s) awaiting Commandant approval.`,
    };
  }

  if (
    req.status === "pending_commandant" &&
    canApproveCertificateAsCommandant(user.role)
  ) {
    await db
      .update(certificateRequests)
      .set({
        status: "approved",
        commandantApprovedBy: user.userId,
        commandantApprovedAt: now,
        updatedAt: now,
      })
      .where(eq(certificateRequests.id, requestId));

    await auditUpdate(
      user,
      "certificate_requests",
      String(requestId),
      { status: req.status },
      {
        action: "approve_commandant",
        certificateCount: req.certificateCount,
        status: "approved",
      }
    );

    const label = await courseLabelForIntake(req.intakeId);
    await notifyCertificateFullyApproved({
      requestId,
      requestNumber: req.requestNumber,
      courseLabel: label,
      certificateCount: req.certificateCount,
    });

    revalidateCertPaths(requestId);
    return {
      success: true as const,
      nextStatus: "approved" as const,
      message: `Approved. ${req.certificateCount} certificate(s) ready to print.`,
    };
  }

  return {
    success: false as const,
    error: "You cannot approve this request at its current stage.",
  };
}

export async function rejectCertificateRequest(
  requestId: number,
  reason: string
) {
  const user = await requireRole(["chief_instructor", "commandant"]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { success: false as const, error: "Rejection reason is required." };
  }

  const [req] = await db
    .select()
    .from(certificateRequests)
    .where(eq(certificateRequests.id, requestId))
    .limit(1);
  if (!req) return { success: false as const, error: "Request not found." };

  let stage: string | null = null;
  if (
    req.status === "pending_chief_instructor" &&
    canApproveCertificateAsChiefInstructor(user.role)
  ) {
    stage = "chief_instructor";
  } else if (
    req.status === "pending_commandant" &&
    canApproveCertificateAsCommandant(user.role)
  ) {
    stage = "commandant";
  } else {
    return {
      success: false as const,
      error: "You cannot reject this request at its current stage.",
    };
  }

  await db
    .update(certificateRequests)
    .set({
      status: "rejected",
      rejectedBy: user.userId,
      rejectedAt: new Date(),
      rejectionReason: trimmed.slice(0, 1000),
      rejectedStage: stage,
      updatedAt: new Date(),
    })
    .where(eq(certificateRequests.id, requestId));

  await auditUpdate(
    user,
    "certificate_requests",
    String(requestId),
    { status: req.status },
    {
      action: "reject",
      stage,
      reason: trimmed.slice(0, 200),
      certificateCount: req.certificateCount,
      status: "rejected",
    }
  );
  revalidateCertPaths(requestId);
  return { success: true as const };
}

export async function prepareCertificate(enrollmentId: number) {
  const user = await requireRole(["admin", "instructor"]);

  const authz = await enrollmentIsPrintAuthorized(enrollmentId);
  if (!authz.ok) {
    return { success: false as const, error: authz.reason };
  }

  const result = await getCertificateData(enrollmentId);
  if (!result.success) return result;

  const recorded = await recordCertificateIssue(result.data, user.userId);

  if (authz.requestId) {
    await db
      .update(certificateRequestItems)
      .set({
        status: "issued",
        issuedAt: new Date(),
        certificateId: recorded.certificateId,
      })
      .where(
        and(
          eq(certificateRequestItems.requestId, authz.requestId),
          eq(certificateRequestItems.enrollmentId, enrollmentId),
          ne(certificateRequestItems.status, "removed")
        )
      );
    await refreshRequestIssueStatus(authz.requestId);
    revalidateCertPaths(authz.requestId);
  }

  return {
    success: true as const,
    data: JSON.parse(JSON.stringify(result.data)),
  };
}

export async function prepareCertificatesForRequest(
  requestId: number,
  enrollmentIds?: number[]
) {
  const user = await requireRole(["admin"]);
  if (!canPrintApprovedCertificates(user.role)) {
    return { success: false as const, error: "Admin only." };
  }

  const [req] = await db
    .select()
    .from(certificateRequests)
    .where(eq(certificateRequests.id, requestId))
    .limit(1);
  if (!req) return { success: false as const, error: "Request not found." };
  if (
    req.status !== "approved" &&
    req.status !== "partially_issued" &&
    req.status !== "issued"
  ) {
    return {
      success: false as const,
      error: "Request must be fully approved before printing.",
    };
  }

  const items = await db
    .select({
      enrollmentId: certificateRequestItems.enrollmentId,
      status: certificateRequestItems.status,
    })
    .from(certificateRequestItems)
    .where(
      and(
        eq(certificateRequestItems.requestId, requestId),
        inArray(certificateRequestItems.status, ["pending", "issued"])
      )
    );

  const wanted = enrollmentIds?.length
    ? items.filter((i) => enrollmentIds.includes(i.enrollmentId))
    : items.filter((i) => i.status === "pending" || i.status === "issued");

  if (wanted.length === 0) {
    return { success: false as const, error: "No certificates selected." };
  }

  const dataList = [];
  for (const item of wanted) {
    const result = await getCertificateData(item.enrollmentId);
    if (!result.success) {
      return {
        success: false as const,
        error: result.error ?? `Failed for enrollment ${item.enrollmentId}`,
      };
    }
    const recorded = await recordCertificateIssue(result.data, user.userId);
    await db
      .update(certificateRequestItems)
      .set({
        status: "issued",
        issuedAt: new Date(),
        certificateId: recorded.certificateId,
      })
      .where(
        and(
          eq(certificateRequestItems.requestId, requestId),
          eq(certificateRequestItems.enrollmentId, item.enrollmentId)
        )
      );
    dataList.push(result.data);
  }

  await refreshRequestIssueStatus(requestId);
  revalidateCertPaths(requestId);

  return {
    success: true as const,
    data: JSON.parse(JSON.stringify(dataList)),
  };
}

export async function getEligibleStudentsAction(intakeId: number) {
  await requireRole(["admin"]);
  const [intake] = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);
  if (!intake) return { success: false as const, error: "Intake not found." };

  const studentsList = await listEligibleEnrollmentsForIntake(intakeId);
  return {
    success: true as const,
    intake,
    students: studentsList.map((s) => ({
      enrollmentId: s.enrollmentId,
      armyNumber: s.armyNumber,
      fullName: s.fullName,
      rank: s.rankAtEnrollment,
      grade: s.grade,
      averageMarks: s.averageMarks,
      unit: s.unit,
      position: s.position,
    })),
  };
}
