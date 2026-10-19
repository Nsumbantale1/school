import { and, desc, eq, inArray, isNotNull, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  courseIntakes,
  courses,
  enrollments,
  resultChangeItems,
  resultChangeRequests,
  results,
  students,
  users,
} from "@/lib/db/schema";
import type { SessionUser, UserRole } from "@/lib/auth/types";
import { calculateGrade } from "./grades";
import { recalculateEnrollmentMarks, recalculatePositions } from "./positions";
import { notifyUserIds, notifyUsersByRole } from "./notify";
import { logAudit } from "./audit";

export type ResultChangeStatus =
  | "pending_chief_instructor"
  | "pending_commandant"
  | "applied"
  | "rejected"
  | "cancelled";

export const RESULT_CHANGE_STATUS_LABEL: Record<ResultChangeStatus, string> = {
  pending_chief_instructor: "Waiting for Chief Instructor",
  pending_commandant: "Waiting for Commandant",
  applied: "Approved and applied",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const OPEN_RESULT_CHANGE: ResultChangeStatus[] = [
  "pending_chief_instructor",
  "pending_commandant",
];

export type NewResultChangeItem =
  | {
      kind: "update_result";
      enrollmentId: number;
      resultId: number;
      subjectName: string;
      oldMarks: string;
      oldMaxMarks: string;
      oldGrade: string | null;
      newMarks: number;
      newMaxMarks: number;
    }
  | {
      kind: "delete_result";
      enrollmentId: number;
      resultId: number;
      subjectName: string;
      oldMarks: string;
      oldMaxMarks: string;
      oldGrade: string | null;
    }
  | {
      kind: "enrollment_marks";
      enrollmentId: number;
      oldAverage: string | null;
      oldGrade: string | null;
      oldPosition: number | null;
      newAverage: string | null;
      newGrade: string | null;
      newPosition: number | null;
    };

const sameNumber = (a: string | number | null | undefined, b: string | number | null | undefined) => {
  if (a == null || a === "") return b == null || b === "";
  if (b == null || b === "") return false;
  return Math.abs(Number(a) - Number(b)) < 0.005;
};

/** True when an already recorded mark would really change. */
export function marksDiffer(
  current: { marksObtained: string; maxMarks: string },
  next: { marksObtained: number; maxMarks: number }
) {
  return (
    !sameNumber(current.marksObtained, next.marksObtained) ||
    !sameNumber(current.maxMarks, next.maxMarks)
  );
}

async function nextRequestNumber(): Promise<string> {
  const prefix = `RC-${new Date().getFullYear()}-`;
  const [row] = await db
    .select({ requestNumber: resultChangeRequests.requestNumber })
    .from(resultChangeRequests)
    .where(like(resultChangeRequests.requestNumber, `${prefix}%`))
    .orderBy(desc(resultChangeRequests.id))
    .limit(1);
  const last = row ? parseInt(row.requestNumber.slice(prefix.length), 10) : 0;
  return `${prefix}${String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0")}`;
}

async function intakeLabel(intakeId: number): Promise<string> {
  const [row] = await db
    .select({ courseCode: courses.courseCode, intakeNumber: courseIntakes.intakeNumber })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);
  return row ? `${row.courseCode} · ${row.intakeNumber}` : `intake ${intakeId}`;
}

function itemValues(requestId: number, item: NewResultChangeItem) {
  if (item.kind === "enrollment_marks") {
    return {
      requestId,
      kind: item.kind,
      enrollmentId: item.enrollmentId,
      oldAverage: item.oldAverage,
      newAverage: item.newAverage,
      oldGrade: item.oldGrade,
      newGrade: item.newGrade,
      oldPosition: item.oldPosition,
      newPosition: item.newPosition,
    };
  }
  const base = {
    requestId,
    kind: item.kind,
    enrollmentId: item.enrollmentId,
    resultId: item.resultId,
    subjectName: item.subjectName,
    oldMarks: item.oldMarks,
    oldMaxMarks: item.oldMaxMarks,
    oldGrade: item.oldGrade,
  };
  if (item.kind === "delete_result") return base;
  return {
    ...base,
    newMarks: item.newMarks.toFixed(2),
    newMaxMarks: item.newMaxMarks.toFixed(2),
    newGrade: calculateGrade(item.newMarks, item.newMaxMarks),
  };
}

/** Records the request and alerts the Chief Instructor. Nothing changes yet. */
export async function createResultChangeRequest(opts: {
  user: SessionUser;
  intakeId: number;
  source: "manual" | "import" | "enrollment";
  reason: string;
  items: NewResultChangeItem[];
}): Promise<{ id: number; requestNumber: string }> {
  const requestNumber = await nextRequestNumber();
  const [request] = await db
    .insert(resultChangeRequests)
    .values({
      requestNumber,
      intakeId: opts.intakeId,
      source: opts.source,
      reason: opts.reason,
      requestedBy: opts.user.userId,
    })
    .returning({ id: resultChangeRequests.id });

  await db.insert(resultChangeItems).values(opts.items.map((item) => itemValues(request.id, item)));

  const label = await intakeLabel(opts.intakeId);
  await Promise.all([
    logAudit({
      user: opts.user,
      action: "create",
      tableName: "result_change_requests",
      recordId: requestNumber,
      newValues: { intakeId: opts.intakeId, items: opts.items.length, reason: opts.reason },
    }),
    notifyUsersByRole({
      roles: ["chief_instructor"],
      title: `Approve result change — ${requestNumber}`,
      body: `${opts.user.name} asks to change ${opts.items.length} recorded mark(s) for ${label}. Reason: ${opts.reason}`,
      href: `/results/changes/${request.id}`,
      kind: "result_change",
    }).catch((error) => console.warn("Result change notification failed:", error)),
  ]);

  return { id: request.id, requestNumber };
}

export function canDecideResultChange(role: UserRole, status: string) {
  return (
    (role === "chief_instructor" && status === "pending_chief_instructor") ||
    (role === "commandant" && status === "pending_commandant")
  );
}

type ActionResult = { success: true; message: string } | { success: false; error: string };

async function loadRequest(id: number) {
  const [request] = await db
    .select()
    .from(resultChangeRequests)
    .where(eq(resultChangeRequests.id, id))
    .limit(1);
  return request ?? null;
}

export async function approveResultChange(user: SessionUser, id: number): Promise<ActionResult> {
  const request = await loadRequest(id);
  if (!request) return { success: false, error: "Request not found." };
  if (!canDecideResultChange(user.role, request.status)) {
    return { success: false, error: "This request is not waiting for your approval." };
  }
  const label = await intakeLabel(request.intakeId);
  const now = new Date();

  if (user.role === "chief_instructor") {
    const moved = await db
      .update(resultChangeRequests)
      .set({
        status: "pending_commandant",
        chiefInstructorApprovedBy: user.userId,
        chiefInstructorApprovedAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(resultChangeRequests.id, id), eq(resultChangeRequests.status, "pending_chief_instructor"))
      )
      .returning({ id: resultChangeRequests.id });
    if (moved.length === 0) return { success: false, error: "Request was already handled." };

    await Promise.all([
      logAudit({
        user,
        action: "update",
        tableName: "result_change_requests",
        recordId: request.requestNumber,
        newValues: { status: "pending_commandant", approvedBy: "chief_instructor" },
      }),
      notifyUsersByRole({
        roles: ["commandant"],
        title: `Commandant approval — ${request.requestNumber}`,
        body: `Chief Instructor approved a change to recorded marks for ${label}. It is applied only after your approval.`,
        href: `/results/changes/${id}`,
        kind: "result_change",
      }),
      notifyUserIds({
        userIds: [request.requestedBy],
        title: `Chief Instructor approved — ${request.requestNumber}`,
        body: `Your result change for ${label} is now waiting for the Commandant.`,
        href: `/results/changes/${id}`,
        kind: "result_change",
      }),
    ]).catch((error) => console.warn("Result change notification failed:", error));
    return { success: true, message: "Approved. Sent to the Commandant." };
  }

  const claimed = await db
    .update(resultChangeRequests)
    .set({
      status: "applied",
      commandantApprovedBy: user.userId,
      commandantApprovedAt: now,
      appliedAt: now,
      updatedAt: now,
    })
    .where(and(eq(resultChangeRequests.id, id), eq(resultChangeRequests.status, "pending_commandant")))
    .returning({ id: resultChangeRequests.id });
  if (claimed.length === 0) return { success: false, error: "Request was already handled." };

  const summary = await applyResultChange(id, request.intakeId, request.requestedBy);
  const message =
    summary.skipped > 0
      ? `Approved. ${summary.applied} change(s) applied; ${summary.skipped} skipped because the marks changed after the request.`
      : `Approved. ${summary.applied} change(s) applied.`;

  await Promise.all([
    logAudit({
      user,
      action: "update",
      tableName: "result_change_requests",
      recordId: request.requestNumber,
      newValues: { status: "applied", ...summary },
    }),
    notifyUserIds({
      userIds: [request.requestedBy, request.chiefInstructorApprovedBy ?? 0].filter(Boolean),
      title: `Result change applied — ${request.requestNumber}`,
      body: `The Commandant approved the change for ${label}. ${message}`,
      href: `/results/changes/${id}`,
      kind: "result_change",
    }),
  ]).catch((error) => console.warn("Result change notification failed:", error));

  return { success: true, message };
}

export async function rejectResultChange(
  user: SessionUser,
  id: number,
  reason: string
): Promise<ActionResult> {
  const request = await loadRequest(id);
  if (!request) return { success: false, error: "Request not found." };
  if (!canDecideResultChange(user.role, request.status)) {
    return { success: false, error: "This request is not waiting for your decision." };
  }
  if (reason.trim().length < 3) return { success: false, error: "Give a reason for rejecting." };

  const now = new Date();
  const updated = await db
    .update(resultChangeRequests)
    .set({
      status: "rejected",
      rejectedBy: user.userId,
      rejectedAt: now,
      rejectedStage: user.role,
      rejectionReason: reason.trim(),
      updatedAt: now,
    })
    .where(and(eq(resultChangeRequests.id, id), eq(resultChangeRequests.status, request.status)))
    .returning({ id: resultChangeRequests.id });
  if (updated.length === 0) return { success: false, error: "Request was already handled." };

  const label = await intakeLabel(request.intakeId);
  const who = user.role === "chief_instructor" ? "Chief Instructor" : "Commandant";
  await Promise.all([
    logAudit({
      user,
      action: "update",
      tableName: "result_change_requests",
      recordId: request.requestNumber,
      newValues: { status: "rejected", reason: reason.trim() },
    }),
    notifyUserIds({
      userIds: [request.requestedBy],
      title: `Result change rejected — ${request.requestNumber}`,
      body: `${who} rejected the change for ${label}: ${reason.trim()}. The marks were not changed.`,
      href: `/results/changes/${id}`,
      kind: "result_change",
    }),
  ]).catch((error) => console.warn("Result change notification failed:", error));

  return { success: true, message: "Rejected. The marks stay as they are." };
}

export async function cancelResultChange(user: SessionUser, id: number): Promise<ActionResult> {
  const request = await loadRequest(id);
  if (!request) return { success: false, error: "Request not found." };
  if (request.requestedBy !== user.userId && user.role !== "admin") {
    return { success: false, error: "Only the person who asked (or an admin) can cancel." };
  }
  const updated = await db
    .update(resultChangeRequests)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(eq(resultChangeRequests.id, id), inArray(resultChangeRequests.status, OPEN_RESULT_CHANGE))
    )
    .returning({ id: resultChangeRequests.id });
  if (updated.length === 0) return { success: false, error: "Only waiting requests can be cancelled." };

  await logAudit({
    user,
    action: "update",
    tableName: "result_change_requests",
    recordId: request.requestNumber,
    newValues: { status: "cancelled" },
  });
  return { success: true, message: "Request cancelled." };
}

/**
 * Applies each change only if the marks are still what the requester saw;
 * anything edited in the meantime is skipped rather than overwritten.
 */
async function applyResultChange(requestId: number, intakeId: number, requestedBy: number) {
  const items = await db
    .select()
    .from(resultChangeItems)
    .where(eq(resultChangeItems.requestId, requestId));

  let applied = 0;
  let skipped = 0;
  const touched = new Set<number>();
  let resultsChanged = false;

  const mark = (id: number, status: "applied" | "skipped", note: string | null = null) =>
    db.update(resultChangeItems).set({ status, note }).where(eq(resultChangeItems.id, id));

  for (const item of items) {
    if (item.kind === "update_result" || item.kind === "delete_result") {
      const [current] = item.resultId
        ? await db.select().from(results).where(eq(results.resultId, item.resultId)).limit(1)
        : [];
      if (
        !current ||
        !sameNumber(current.marksObtained, item.oldMarks) ||
        !sameNumber(current.maxMarks, item.oldMaxMarks)
      ) {
        skipped++;
        await mark(item.id, "skipped", "Marks changed or removed after the request was made.");
        continue;
      }
      if (item.kind === "delete_result") {
        await db.delete(results).where(eq(results.resultId, current.resultId));
      } else {
        const marks = Number(item.newMarks);
        const max = Number(item.newMaxMarks);
        await db
          .update(results)
          .set({
            marksObtained: marks.toFixed(2),
            maxMarks: max.toFixed(2),
            grade: calculateGrade(marks, max),
            enteredBy: requestedBy,
            updatedAt: new Date(),
          })
          .where(eq(results.resultId, current.resultId));
      }
      resultsChanged = true;
      touched.add(item.enrollmentId);
      applied++;
      await mark(item.id, "applied");
      continue;
    }

    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.enrollmentId, item.enrollmentId))
      .limit(1);
    if (
      !enrollment ||
      !sameNumber(enrollment.averageMarks, item.oldAverage) ||
      (enrollment.grade ?? null) !== (item.oldGrade ?? null) ||
      (enrollment.position ?? null) !== (item.oldPosition ?? null)
    ) {
      skipped++;
      await mark(item.id, "skipped", "Average, grade or position changed after the request was made.");
      continue;
    }
    const average = item.newAverage;
    const belowPass =
      average != null &&
      Number(average) < 55 &&
      enrollment.status !== "indiscipline" &&
      enrollment.status !== "withdrawn" &&
      enrollment.status !== "failed" &&
      enrollment.status !== "incomplete";
    await db
      .update(enrollments)
      .set({
        averageMarks: average,
        totalMarks: average,
        grade: (item.newGrade as "A" | "B" | "C" | "D" | "F" | null) ?? (belowPass ? "F" : null),
        position: item.newPosition,
        ...(belowPass
          ? { status: "incomplete" as const, ceasedAt: enrollment.ceasedAt ?? new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(enrollments.enrollmentId, item.enrollmentId));
    touched.add(item.enrollmentId);
    applied++;
    await mark(item.id, "applied");
  }

  if (resultsChanged) {
    for (const enrollmentId of touched) await recalculateEnrollmentMarks(enrollmentId);
    await recalculatePositions(intakeId);
  }

  return { applied, skipped };
}

export async function listResultChangeAlarms(user: SessionUser) {
  const status =
    user.role === "chief_instructor"
      ? "pending_chief_instructor"
      : user.role === "commandant"
        ? "pending_commandant"
        : null;
  if (!status) return [];
  return db
    .select({
      id: resultChangeRequests.id,
      requestNumber: resultChangeRequests.requestNumber,
      courseCode: courses.courseCode,
      intakeNumber: courseIntakes.intakeNumber,
      requestedByName: users.name,
    })
    .from(resultChangeRequests)
    .innerJoin(courseIntakes, eq(resultChangeRequests.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .innerJoin(users, eq(resultChangeRequests.requestedBy, users.id))
    .where(eq(resultChangeRequests.status, status))
    .orderBy(desc(resultChangeRequests.createdAt))
    .limit(6);
}

/** Admin and officials see every request; instructors see their own. */
export async function listResultChangeRequests(user: SessionUser) {
  const seesAll = ["admin", "chief_instructor", "commandant"].includes(user.role);
  return db
    .select({
      id: resultChangeRequests.id,
      requestNumber: resultChangeRequests.requestNumber,
      status: resultChangeRequests.status,
      source: resultChangeRequests.source,
      reason: resultChangeRequests.reason,
      createdAt: resultChangeRequests.createdAt,
      courseCode: courses.courseCode,
      intakeNumber: courseIntakes.intakeNumber,
      requestedByName: users.name,
    })
    .from(resultChangeRequests)
    .innerJoin(courseIntakes, eq(resultChangeRequests.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .innerJoin(users, eq(resultChangeRequests.requestedBy, users.id))
    .where(seesAll ? undefined : eq(resultChangeRequests.requestedBy, user.userId))
    .orderBy(desc(resultChangeRequests.createdAt))
    .limit(300);
}

export async function getResultChangeRequest(id: number) {
  const request = await loadRequest(id);
  if (!request) return null;

  const userIds = [
    request.requestedBy,
    request.chiefInstructorApprovedBy,
    request.commandantApprovedBy,
    request.rejectedBy,
  ].filter((v): v is number => v != null);

  const [intake, people, items] = await Promise.all([
    db
      .select({
        courseCode: courses.courseCode,
        courseName: courses.courseName,
        intakeNumber: courseIntakes.intakeNumber,
      })
      .from(courseIntakes)
      .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
      .where(eq(courseIntakes.intakeId, request.intakeId))
      .limit(1),
    db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)),
    db
      .select({
        item: resultChangeItems,
        armyNumber: students.armyNumber,
        fullName: students.fullName,
        rank: enrollments.rankAtEnrollment,
      })
      .from(resultChangeItems)
      .innerJoin(enrollments, eq(resultChangeItems.enrollmentId, enrollments.enrollmentId))
      .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
      .where(eq(resultChangeItems.requestId, id))
      .orderBy(resultChangeItems.id),
  ]);

  const nameOf = (userId: number | null) =>
    userId == null ? null : (people.find((p) => p.id === userId)?.name ?? null);

  return {
    request,
    intake: intake[0] ?? null,
    requestedByName: nameOf(request.requestedBy),
    chiefInstructorName: nameOf(request.chiefInstructorApprovedBy),
    commandantName: nameOf(request.commandantApprovedBy),
    rejectedByName: nameOf(request.rejectedBy),
    items,
  };
}

/**
 * Open requests that already cover these results (all open ones when no ids are given),
 * so the same mark is not asked twice.
 */
export async function openChangesForResults(resultIds?: number[]) {
  const map = new Map<number, { id: number; requestNumber: string }>();
  if (resultIds && resultIds.length === 0) return map;
  const rows = await db
    .select({
      resultId: resultChangeItems.resultId,
      id: resultChangeRequests.id,
      requestNumber: resultChangeRequests.requestNumber,
    })
    .from(resultChangeItems)
    .innerJoin(resultChangeRequests, eq(resultChangeItems.requestId, resultChangeRequests.id))
    .where(
      and(
        resultIds
          ? inArray(resultChangeItems.resultId, resultIds)
          : isNotNull(resultChangeItems.resultId),
        inArray(resultChangeRequests.status, OPEN_RESULT_CHANGE)
      )
    );
  for (const r of rows) map.set(r.resultId!, { id: r.id, requestNumber: r.requestNumber });
  return map;
}

/** Enrollments in scope that already carry marks; deleting them would wipe recorded results. */
export async function countEnrollmentsWithMarks(
  scope: { enrollmentId: number } | { intakeId: number }
) {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${enrollments.enrollmentId})::int` })
    .from(enrollments)
    .leftJoin(results, eq(results.enrollmentId, enrollments.enrollmentId))
    .where(
      and(
        "enrollmentId" in scope
          ? eq(enrollments.enrollmentId, scope.enrollmentId)
          : eq(enrollments.intakeId, scope.intakeId),
        or(isNotNull(results.resultId), isNotNull(enrollments.averageMarks))
      )
    );
  return Number(row?.n ?? 0);
}

export async function openChangeForEnrollment(enrollmentId: number) {
  const [row] = await db
    .select({ id: resultChangeRequests.id, requestNumber: resultChangeRequests.requestNumber })
    .from(resultChangeItems)
    .innerJoin(resultChangeRequests, eq(resultChangeItems.requestId, resultChangeRequests.id))
    .where(
      and(
        eq(resultChangeItems.enrollmentId, enrollmentId),
        eq(resultChangeItems.kind, "enrollment_marks"),
        or(
          eq(resultChangeRequests.status, "pending_chief_instructor"),
          eq(resultChangeRequests.status, "pending_commandant")
        )
      )
    )
    .limit(1);
  return row ?? null;
}
