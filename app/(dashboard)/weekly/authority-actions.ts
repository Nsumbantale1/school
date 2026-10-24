"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { courseIntakes, courses, progressEditAuthorities } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guards";
import { canCoordinateCourse } from "@/lib/auth/permissions";
import { notifyUserIds, notifyUsersByRole } from "@/lib/utils/notify";
import {
  intakeHasRecordedMarks,
  openProgressAuthority,
  pendingProgressAuthority,
} from "@/lib/utils/progress-authority";
import { formatIntakeLabel } from "@/lib/utils/intake-label";

async function intakeLabel(intakeId: number) {
  const [row] = await db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      intakeNumber: courseIntakes.intakeNumber,
      startDate: courseIntakes.startDate,
      endDate: courseIntakes.endDate,
      year: courseIntakes.year,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);
  if (!row) return null;
  return {
    courseId: row.courseId,
    label: `${row.courseCode} · ${formatIntakeLabel(row)}`,
  };
}

export async function requestProgressAuthority(intakeId: number, reason: string) {
  const user = await requireAuth();
  if (user.role !== "instructor") {
    return { success: false as const, error: "Only the course coordinator asks for this authority." };
  }
  const intake = await intakeLabel(intakeId);
  if (!intake || !canCoordinateCourse(user, intake.courseId)) {
    return { success: false as const, error: "You can only ask for your own course." };
  }
  const text = reason.trim();
  if (text.length < 8) {
    return { success: false as const, error: "Say what you need to change, in a short reason." };
  }
  if (!(await intakeHasRecordedMarks(intakeId))) {
    return { success: false as const, error: "Nothing is locked yet. Enter the marks first." };
  }
  if (await openProgressAuthority(intakeId, user.userId)) {
    return { success: false as const, error: "The Chief Instructor has already authorized changes." };
  }
  if (await pendingProgressAuthority(intakeId, user.userId)) {
    return { success: false as const, error: "A request is already waiting for the Chief Instructor." };
  }

  const [created] = await db
    .insert(progressEditAuthorities)
    .values({
      intakeId,
      requestedBy: user.userId,
      reason: text,
      status: "pending",
    })
    .returning({ id: progressEditAuthorities.id });

  await notifyUsersByRole({
    roles: ["chief_instructor"],
    title: "Weekly marks need your authority",
    body: `${user.name} wants to change recorded weekly marks for ${intake.label}. Reason: ${text}`,
    href: "/weekly/authority",
    kind: "progress_authority",
  });

  revalidatePath(`/weekly/${intakeId}`);
  revalidatePath("/weekly/authority");
  return { success: true as const, id: created.id };
}

export async function decideProgressAuthority(
  id: number,
  decision: "granted" | "rejected",
  note: string
) {
  const user = await requireAuth();
  if (user.role !== "chief_instructor") {
    return { success: false as const, error: "Only the Chief Instructor can give this authority." };
  }

  const [request] = await db
    .select({
      id: progressEditAuthorities.id,
      intakeId: progressEditAuthorities.intakeId,
      requestedBy: progressEditAuthorities.requestedBy,
      status: progressEditAuthorities.status,
    })
    .from(progressEditAuthorities)
    .where(eq(progressEditAuthorities.id, id))
    .limit(1);
  if (!request || request.status !== "pending") {
    return { success: false as const, error: "That request is no longer waiting." };
  }

  await db
    .update(progressEditAuthorities)
    .set({
      status: decision,
      decidedBy: user.userId,
      decidedAt: new Date(),
      decisionNote: note.trim() || null,
    })
    .where(and(eq(progressEditAuthorities.id, id), eq(progressEditAuthorities.status, "pending")));

  const intake = await intakeLabel(request.intakeId);
  await notifyUserIds({
    userIds: [request.requestedBy],
    title:
      decision === "granted"
        ? "Chief Instructor authorized the correction"
        : "Chief Instructor refused the correction",
    body:
      decision === "granted"
        ? `You may change the recorded weekly marks for ${intake?.label ?? "this intake"}. Lock them again when you finish.`
        : `${user.name} did not authorize changes${note.trim() ? `: ${note.trim()}` : "."}`,
    href: `/weekly/${request.intakeId}`,
    kind: "progress_authority",
  });

  revalidatePath(`/weekly/${request.intakeId}`);
  revalidatePath("/weekly/authority");
  return { success: true as const };
}

export async function closeProgressAuthority(intakeId: number) {
  const user = await requireAuth();
  const grant =
    user.role === "instructor" ? await openProgressAuthority(intakeId, user.userId) : null;
  if (user.role === "instructor") {
    if (!grant) return { success: false as const, error: "There is no open authority to close." };
    await db
      .update(progressEditAuthorities)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(progressEditAuthorities.id, grant.id));
  } else if (user.role === "chief_instructor") {
    await db
      .update(progressEditAuthorities)
      .set({ status: "closed", closedAt: new Date(), decidedBy: user.userId })
      .where(
        and(
          eq(progressEditAuthorities.intakeId, intakeId),
          eq(progressEditAuthorities.status, "granted")
        )
      );
  } else {
    return { success: false as const, error: "You cannot close this authority." };
  }

  revalidatePath(`/weekly/${intakeId}`);
  revalidatePath("/weekly/authority");
  return { success: true as const };
}
