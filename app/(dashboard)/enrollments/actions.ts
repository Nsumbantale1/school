"use server";

import { db } from "@/lib/db";
import { enrollments, courseIntakes, courses, students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { checkPrerequisites } from "@/lib/utils/prerequisites";
import { checkIndisciplineBan } from "@/lib/utils/indiscipline-ban";
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

  const [student] = await db
    .select({ rank: students.rank, unit: students.unit })
    .from(students)
    .where(eq(students.armyNumber, studentArmyNumber))
    .limit(1);

  if (!student) {
    return { success: false, error: "Student not found." };
  }

  // Block if student has an active indiscipline ban (3 years)
  const banCheck = await checkIndisciplineBan(studentArmyNumber);
  if (banCheck.blocked) {
    return {
      success: false,
      error: banCheck.message,
      indisciplineError: true,
      incident: banCheck.incident,
    };
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
        rankAtEnrollment: student.rank,
        unitAtEnrollment: student.unit,
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

export async function updateEnrollment(enrollmentId: number, formData: FormData) {
  const user = await requireRole(["admin"]);

  const [existing] = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.enrollmentId, enrollmentId))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Enrollment not found." };
  }

  const rankAtEnrollment = String(formData.get("rankAtEnrollment") ?? "").trim();
  const unitRaw = String(formData.get("unitAtEnrollment") ?? "").trim();
  const status = formData.get("status") as
    | "enrolled"
    | "in_progress"
    | "completed"
    | "failed"
    | "incomplete"
    | "indiscipline"
    | "withdrawn";
  const ceasedAtRaw = formData.get("ceasedAt") as string | null;
  const ceasedAt =
    ceasedAtRaw && ceasedAtRaw.length > 0 ? new Date(ceasedAtRaw) : null;

  const averageRaw = String(formData.get("averageMarks") ?? "").trim();
  const gradeRaw = String(formData.get("grade") ?? "").trim().toUpperCase();
  const positionRaw = String(formData.get("position") ?? "").trim();

  if (!rankAtEnrollment) {
    return { success: false, error: "Rank at course is required." };
  }

  if (
    !["enrolled", "in_progress", "completed", "failed", "incomplete", "indiscipline", "withdrawn"].includes(
      status
    )
  ) {
    return { success: false, error: "Invalid status." };
  }

  if (
    (status === "incomplete" || status === "indiscipline" || status === "failed") &&
    !ceasedAt
  ) {
    return {
      success: false,
      error:
        "A ceased date is required for CT ceased training or indiscipline status.",
    };
  }

  let averageMarks: string | null = null;
  if (averageRaw !== "") {
    const n = parseFloat(averageRaw);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { success: false, error: "Average marks must be between 0 and 100." };
    }
    averageMarks = n.toFixed(2);
  }

  const allowedGrades = ["A", "B", "C", "D", "F"] as const;
  let grade: (typeof allowedGrades)[number] | null = null;
  if (gradeRaw !== "") {
    if (!allowedGrades.includes(gradeRaw as (typeof allowedGrades)[number])) {
      return { success: false, error: "Invalid grade." };
    }
    grade = gradeRaw as (typeof allowedGrades)[number];
  }

  let position: number | null = null;
  if (positionRaw !== "") {
    const p = parseInt(positionRaw, 10);
    if (!Number.isFinite(p) || p < 1) {
      return { success: false, error: "Position must be a positive whole number." };
    }
    position = p;
  }

  // Below pass mark → force CT ceased training
  let finalStatus = status;
  let finalGrade = grade;
  let finalCeasedAt =
    status === "incomplete" || status === "indiscipline" || status === "failed"
      ? ceasedAt
      : null;
  if (
    averageMarks != null &&
    parseFloat(averageMarks) < 55 &&
    status !== "indiscipline" &&
    status !== "withdrawn"
  ) {
    finalStatus = "incomplete";
    finalGrade = finalGrade ?? "F";
    finalCeasedAt = ceasedAt ?? new Date();
  }

  try {
    await db
      .update(enrollments)
      .set({
        rankAtEnrollment,
        unitAtEnrollment: unitRaw || null,
        status: finalStatus,
        ceasedAt: finalCeasedAt,
        // Keep totalMarks aligned with average (overall %) for imports that used both.
        totalMarks: averageMarks,
        averageMarks,
        grade: finalGrade,
        position,
        updatedAt: new Date(),
      })
      .where(eq(enrollments.enrollmentId, enrollmentId));

    const changes = getChangedFields(
      {
        rankAtEnrollment: existing.rankAtEnrollment,
        unitAtEnrollment: existing.unitAtEnrollment,
        status: existing.status,
        averageMarks: existing.averageMarks,
        grade: existing.grade,
        position: existing.position,
      },
      {
        rankAtEnrollment,
        unitAtEnrollment: unitRaw || null,
        status: finalStatus,
        averageMarks,
        grade: finalGrade,
        position,
      }
    );
    await auditUpdate(user, "enrollments", String(enrollmentId), changes.old, changes.new);

    revalidatePath("/enrollments");
    revalidatePath(`/enrollments/${enrollmentId}`);
    revalidatePath(`/enrollments/${enrollmentId}/edit`);
    revalidatePath(`/intakes/${existing.intakeId}`);
    revalidatePath(
      `/students/${encodeURIComponent(existing.studentArmyNumber)}`
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
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
    | "incomplete"
    | "indiscipline"
    | "withdrawn";

  const ceasedAtRaw = formData.get("ceasedAt") as string | null;
  const ceasedAt =
    ceasedAtRaw && ceasedAtRaw.length > 0 ? new Date(ceasedAtRaw) : null;

  if (
    (status === "incomplete" || status === "indiscipline" || status === "failed") &&
    !ceasedAt
  ) {
    return {
      success: false,
      error:
        "A ceased date is required for CT ceased training or indiscipline status.",
    };
  }

  try {
    await db
      .update(enrollments)
      .set({
        status,
        ceasedAt:
          status === "incomplete" ||
          status === "indiscipline" ||
          status === "failed"
            ? ceasedAt
            : null,
        updatedAt: new Date(),
      })
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
