"use server";

import { db } from "@/lib/db";
import { results, enrollments, courseIntakes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, canManageResultsForCourse } from "@/lib/auth/guards";
import { calculateGrade } from "@/lib/utils/grades";
import {
  recalculateEnrollmentMarks,
  recalculatePositions,
  getIntakeIdForEnrollment,
} from "@/lib/utils/positions";
import { auditCreate } from "@/lib/utils/audit";
import {
  createResultChangeRequest,
  marksDiffer,
  openChangesForResults,
  type NewResultChangeItem,
} from "@/lib/utils/result-changes";

export async function createResult(formData: FormData) {
  const user = await requireAuth();

  // Check role - admin or instructor
  if (user.role !== "admin" && user.role !== "instructor") {
    return { success: false, error: "Unauthorized: insufficient permissions" };
  }

  const enrollmentId = parseInt(formData.get("enrollmentId") as string);
  const subjectName = formData.get("subjectName") as string;
  const marksObtained = parseFloat(formData.get("marksObtained") as string);
  const maxMarks = parseFloat(formData.get("maxMarks") as string) || 100;
  const remarks = (formData.get("remarks") as string) || null;

  // For instructors, verify they can manage this enrollment's course
  if (user.role === "instructor") {
    const [enrollment] = await db
      .select({ courseId: courseIntakes.courseId })
      .from(enrollments)
      .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
      .where(eq(enrollments.enrollmentId, enrollmentId))
      .limit(1);

    if (!enrollment || !canManageResultsForCourse(user, enrollment.courseId)) {
      return { success: false, error: "You can only manage results for your assigned course." };
    }
  }

  // Auto-calculate grade
  const grade = calculateGrade(marksObtained, maxMarks);

  try {
    const [newResult] = await db
      .insert(results)
      .values({
        enrollmentId,
        subjectName,
        marksObtained: marksObtained.toString(),
        maxMarks: maxMarks.toString(),
        grade,
        remarks,
        enteredBy: user.userId,
      })
      .returning({ resultId: results.resultId });

    // Recalculate enrollment totals
    await recalculateEnrollmentMarks(enrollmentId);

    // Recalculate positions for all students in the intake
    const intakeId = await getIntakeIdForEnrollment(enrollmentId);
    if (intakeId) {
      await recalculatePositions(intakeId);
    }

    await auditCreate(user, "results", String(newResult.resultId), {
      enrollmentId,
      subjectName,
      marksObtained,
      maxMarks,
      grade,
    });

    revalidatePath("/results");
    revalidatePath(`/enrollments/${enrollmentId}`);
    if (intakeId) revalidatePath(`/intakes/${intakeId}`);

    return { success: true, resultId: newResult.resultId };
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("idx_result_unique")) {
      return {
        success: false,
        error: "A result for this subject already exists for this enrollment.",
      };
    }
    return { success: false, error: message };
  }
}

/**
 * Recorded marks are never changed directly: this files a request that the
 * Chief Instructor and then the Commandant must approve.
 */
export async function requestResultChange(input: {
  resultId: number;
  action: "update" | "delete";
  marksObtained?: number;
  maxMarks?: number;
  reason: string;
}): Promise<
  { success: true; requestId: number; requestNumber: string } | { success: false; error: string }
> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "instructor") {
    return { success: false, error: "Only admins and instructors can ask to change results." };
  }

  const reason = input.reason?.trim() ?? "";
  if (reason.length < 5) {
    return { success: false, error: "Explain why the marks must change (at least 5 characters)." };
  }

  const [existing] = await db
    .select({
      result: results,
      intakeId: enrollments.intakeId,
      courseId: courseIntakes.courseId,
    })
    .from(results)
    .innerJoin(enrollments, eq(results.enrollmentId, enrollments.enrollmentId))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .where(eq(results.resultId, input.resultId))
    .limit(1);
  if (!existing) return { success: false, error: "Result not found." };

  if (!canManageResultsForCourse(user, existing.courseId)) {
    return { success: false, error: "You can only manage results for your assigned course." };
  }

  const pending = (await openChangesForResults([input.resultId])).get(input.resultId);
  if (pending) {
    return {
      success: false,
      error: `A change to this mark is already waiting for approval (${pending.requestNumber}).`,
    };
  }

  const current = existing.result;
  const base = {
    enrollmentId: current.enrollmentId,
    resultId: current.resultId,
    subjectName: current.subjectName,
    oldMarks: current.marksObtained,
    oldMaxMarks: current.maxMarks,
    oldGrade: current.grade,
  };

  let item: NewResultChangeItem;
  if (input.action === "delete") {
    item = { kind: "delete_result", ...base };
  } else {
    const marks = Number(input.marksObtained);
    const max = Number(input.maxMarks) || Number(current.maxMarks) || 100;
    if (!Number.isFinite(marks) || marks < 0 || marks > max) {
      return { success: false, error: `Marks must be between 0 and ${max}.` };
    }
    if (!marksDiffer(current, { marksObtained: marks, maxMarks: max })) {
      return { success: false, error: "The new marks are the same as the recorded marks." };
    }
    item = { kind: "update_result", ...base, newMarks: marks, newMaxMarks: max };
  }

  const created = await createResultChangeRequest({
    user,
    intakeId: existing.intakeId,
    source: "manual",
    reason,
    items: [item],
  });

  revalidatePath("/results");
  revalidatePath("/results/changes");
  return { success: true, requestId: created.id, requestNumber: created.requestNumber };
}

export async function updateResult(resultId: number, formData: FormData) {
  return requestResultChange({
    resultId,
    action: "update",
    marksObtained: parseFloat(formData.get("marksObtained") as string),
    maxMarks: parseFloat(formData.get("maxMarks") as string),
    reason: String(formData.get("reason") ?? ""),
  });
}

export async function deleteResult(resultId: number, reason = "") {
  return requestResultChange({ resultId, action: "delete", reason });
}
