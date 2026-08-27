"use server";

import { db } from "@/lib/db";
import { enrollments, courseIntakes, courses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { checkPrerequisites } from "@/lib/utils/prerequisites";
import { recalculatePositions } from "@/lib/utils/positions";
import { auditCreate, auditUpdate, auditDelete, getChangedFields } from "@/lib/utils/audit";

export async function createEnrollment(formData: FormData) {
  const user = await requireRole(["admin"]);

  const studentArmyNumber = formData.get("studentArmyNumber") as string;
  const intakeId = parseInt(formData.get("intakeId") as string);

  // Get course ID from intake for prerequisite check
  const [intake] = await db
    .select({
      courseId: courseIntakes.courseId,
      intakeNumber: courseIntakes.intakeNumber,
    })
    .from(courseIntakes)
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);

  if (!intake) {
    return { success: false, error: "Intake not found." };
  }

  // Check prerequisites
  const prereqCheck = await checkPrerequisites(studentArmyNumber, intake.courseId);
  if (!prereqCheck.eligible) {
    return {
      success: false,
      error: `Prerequisites not met: ${prereqCheck.message}`,
      prerequisiteError: true,
      missingPrerequisites: prereqCheck.missingPrerequisites,
    };
  }

  try {
    const [newEnrollment] = await db
      .insert(enrollments)
      .values({
        studentArmyNumber,
        intakeId,
        status: "enrolled",
      })
      .returning({ enrollmentId: enrollments.enrollmentId });

    await auditCreate(user, "enrollments", String(newEnrollment.enrollmentId), {
      studentArmyNumber,
      intakeId,
    });

    revalidatePath("/enrollments");
    revalidatePath(`/intakes/${intakeId}`);
    revalidatePath(`/students/${encodeURIComponent(studentArmyNumber)}`);
    return { success: true, enrollmentId: newEnrollment.enrollmentId };
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("idx_enrollment_unique")) {
      return { success: false, error: "This student is already enrolled in this intake." };
    }
    return { success: false, error: message };
  }
}

export async function updateEnrollmentStatus(enrollmentId: number, formData: FormData) {
  const user = await requireRole(["admin"]);

  // Get existing enrollment
  const [existing] = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.enrollmentId, enrollmentId))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Enrollment not found." };
  }

  const status = formData.get("status") as
    | "enrolled"
    | "in_progress"
    | "completed"
    | "failed"
    | "withdrawn";

  try {
    await db
      .update(enrollments)
      .set({ status, updatedAt: new Date() })
      .where(eq(enrollments.enrollmentId, enrollmentId));

    // Recalculate positions if status changed to completed/failed
    if (status === "completed" || status === "failed") {
      await recalculatePositions(existing.intakeId);
    }

    const changes = getChangedFields({ status: existing.status }, { status });
    await auditUpdate(user, "enrollments", String(enrollmentId), changes.old, changes.new);

    revalidatePath("/enrollments");
    revalidatePath(`/enrollments/${enrollmentId}`);
    revalidatePath(`/intakes/${existing.intakeId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteEnrollment(enrollmentId: number) {
  const user = await requireRole(["admin"]);

  const [existing] = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.enrollmentId, enrollmentId))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Enrollment not found." };
  }

  try {
    await db.delete(enrollments).where(eq(enrollments.enrollmentId, enrollmentId));

    // Recalculate positions for remaining students
    await recalculatePositions(existing.intakeId);

    await auditDelete(user, "enrollments", String(enrollmentId), {
      studentArmyNumber: existing.studentArmyNumber,
      intakeId: existing.intakeId,
    });

    revalidatePath("/enrollments");
    revalidatePath(`/intakes/${existing.intakeId}`);
    revalidatePath(`/students/${encodeURIComponent(existing.studentArmyNumber)}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
