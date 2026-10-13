"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { courseIntakes, enrollments, progressTests } from "@/lib/db/schema";
import { requireAuth, canManageResultsForCourse } from "@/lib/auth/guards";
import type { ProgressKind } from "@/lib/utils/progress-chart";

export async function saveProgressMark(input: {
  intakeId: number;
  enrollmentId: number;
  kind: ProgressKind;
  period: number;
  marks: string;
}) {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "instructor") {
    return { success: false, error: "You cannot enter these marks." };
  }
  if (input.kind !== "week" && input.kind !== "month") {
    return { success: false, error: "Unknown test type." };
  }
  if (!Number.isInteger(input.period) || input.period < 1 || input.period > 52) {
    return { success: false, error: "That week or month is not valid." };
  }

  const [enrollment] = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      courseId: courseIntakes.courseId,
      intakeId: enrollments.intakeId,
    })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .where(eq(enrollments.enrollmentId, input.enrollmentId))
    .limit(1);

  if (!enrollment || enrollment.intakeId !== input.intakeId) {
    return { success: false, error: "Student is not on this intake." };
  }
  if (
    user.role === "instructor" &&
    !canManageResultsForCourse(user, enrollment.courseId)
  ) {
    return { success: false, error: "You can only enter marks for your course." };
  }

  const raw = input.marks.trim();
  if (raw === "") {
    await db
      .delete(progressTests)
      .where(
        and(
          eq(progressTests.enrollmentId, input.enrollmentId),
          eq(progressTests.kind, input.kind),
          eq(progressTests.period, input.period)
        )
      );
    revalidatePath(`/weekly/${input.intakeId}`);
    return { success: true };
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return { success: false, error: "Enter a mark from 0 to 100." };
  }

  const marks = value.toFixed(2);
  await db
    .insert(progressTests)
    .values({
      enrollmentId: input.enrollmentId,
      kind: input.kind,
      period: input.period,
      marks,
      updatedBy: user.userId,
    })
    .onConflictDoUpdate({
      target: [
        progressTests.enrollmentId,
        progressTests.kind,
        progressTests.period,
      ],
      set: {
        marks,
        updatedBy: user.userId,
        updatedAt: new Date(),
      },
    });

  revalidatePath(`/weekly/${input.intakeId}`);
  return { success: true };
}
