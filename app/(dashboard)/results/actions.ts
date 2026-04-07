"use server";

import { db } from "@/lib/db";
import { results, enrollments, courseIntakes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole, requireAuth, canManageResultsForCourse } from "@/lib/auth/guards";
import { calculateGrade } from "@/lib/utils/grades";
import {
  recalculateEnrollmentMarks,
  recalculatePositions,
  getIntakeIdForEnrollment,
} from "@/lib/utils/positions";
import { auditCreate, auditUpdate, auditDelete, getChangedFields } from "@/lib/utils/audit";

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

export async function updateResult(resultId: number, formData: FormData) {
  const user = await requireAuth();

  if (user.role !== "admin" && user.role !== "instructor") {
    return { success: false, error: "Unauthorized: insufficient permissions" };
  }

  // Get existing result
  const [existing] = await db
    .select()
    .from(results)
    .where(eq(results.resultId, resultId))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Result not found." };
  }

  // For instructors, verify course access
  if (user.role === "instructor") {
    const [enrollment] = await db
      .select({ courseId: courseIntakes.courseId })
      .from(enrollments)
      .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
      .where(eq(enrollments.enrollmentId, existing.enrollmentId))
      .limit(1);

    if (!enrollment || !canManageResultsForCourse(user, enrollment.courseId)) {
      return { success: false, error: "You can only manage results for your assigned course." };
    }
  }

  const marksObtained = parseFloat(formData.get("marksObtained") as string);
  const maxMarks = parseFloat(formData.get("maxMarks") as string) || 100;
  const remarks = (formData.get("remarks") as string) || null;

  // Auto-calculate grade
  const grade = calculateGrade(marksObtained, maxMarks);

  const newData = {
    marksObtained: marksObtained.toString(),
    maxMarks: maxMarks.toString(),
    grade,
    remarks,
    updatedAt: new Date(),
  };

  try {
    await db
      .update(results)
      .set(newData)
      .where(eq(results.resultId, resultId));

    // Recalculate enrollment totals
    await recalculateEnrollmentMarks(existing.enrollmentId);

    // Recalculate positions
    const intakeId = await getIntakeIdForEnrollment(existing.enrollmentId);
    if (intakeId) {
      await recalculatePositions(intakeId);
    }

    const changes = getChangedFields(
      {
        marksObtained: existing.marksObtained,
        maxMarks: existing.maxMarks,
        grade: existing.grade,
      },
      { marksObtained: marksObtained.toString(), maxMarks: maxMarks.toString(), grade }
    );
    await auditUpdate(user, "results", String(resultId), changes.old, changes.new);

    revalidatePath("/results");
    revalidatePath(`/enrollments/${existing.enrollmentId}`);
    if (intakeId) revalidatePath(`/intakes/${intakeId}`);

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteResult(resultId: number) {
  const user = await requireRole(["admin"]);

  const [existing] = await db
    .select()
    .from(results)
    .where(eq(results.resultId, resultId))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Result not found." };
  }

  try {
    await db.delete(results).where(eq(results.resultId, resultId));

    // Recalculate enrollment totals
    await recalculateEnrollmentMarks(existing.enrollmentId);

    // Recalculate positions
    const intakeId = await getIntakeIdForEnrollment(existing.enrollmentId);
    if (intakeId) {
      await recalculatePositions(intakeId);
    }

    await auditDelete(user, "results", String(resultId), {
      enrollmentId: existing.enrollmentId,
      subjectName: existing.subjectName,
      marksObtained: existing.marksObtained,
    });

    revalidatePath("/results");
    revalidatePath(`/enrollments/${existing.enrollmentId}`);
    if (intakeId) revalidatePath(`/intakes/${intakeId}`);

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
