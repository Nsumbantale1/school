"use server";

import { db } from "@/lib/db";
import { courseIntakes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { auditCreate, auditUpdate, auditDelete, getChangedFields } from "@/lib/utils/audit";

export async function createIntake(formData: FormData) {
  const user = await requireRole(["admin"]);

  const courseId = parseInt(formData.get("courseId") as string);
  const intakeNumber = formData.get("intakeNumber") as string;
  const year = parseInt(formData.get("year") as string);
  const commanderName = (formData.get("commanderName") as string) || null;
  const coordinatorName = (formData.get("coordinatorName") as string) || null;
  const startDate = formData.get("startDate") as string;
  const endDate = (formData.get("endDate") as string) || null;

  try {
    const [newIntake] = await db
      .insert(courseIntakes)
      .values({
        courseId,
        intakeNumber,
        year,
        commanderName,
        coordinatorName,
        startDate,
        endDate,
      })
      .returning({ intakeId: courseIntakes.intakeId });

    await auditCreate(user, "course_intakes", String(newIntake.intakeId), {
      courseId,
      intakeNumber,
      year,
      commanderName,
      coordinatorName,
      startDate,
      endDate,
    });

    revalidatePath("/intakes");
    revalidatePath(`/courses/${courseId}`);
    return { success: true, intakeId: newIntake.intakeId };
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("duplicate key") || message.includes("idx_intake_unique")) {
      return { success: false, error: "An intake with this number already exists for this course." };
    }
    return { success: false, error: message };
  }
}

export async function updateIntake(intakeId: number, formData: FormData) {
  const user = await requireRole(["admin"]);

  // Get existing data for audit
  const [existing] = await db
    .select()
    .from(courseIntakes)
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Intake not found." };
  }

  const newData = {
    intakeNumber: formData.get("intakeNumber") as string,
    year: parseInt(formData.get("year") as string),
    commanderName: (formData.get("commanderName") as string) || null,
    coordinatorName: (formData.get("coordinatorName") as string) || null,
    startDate: formData.get("startDate") as string,
    endDate: (formData.get("endDate") as string) || null,
    updatedAt: new Date(),
  };

  try {
    await db
      .update(courseIntakes)
      .set(newData)
      .where(eq(courseIntakes.intakeId, intakeId));

    const changes = getChangedFields(existing, newData);
    await auditUpdate(user, "course_intakes", String(intakeId), changes.old, changes.new);

    revalidatePath("/intakes");
    revalidatePath(`/intakes/${intakeId}`);
    revalidatePath(`/courses/${existing.courseId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteIntake(intakeId: number) {
  const user = await requireRole(["admin"]);

  const [existing] = await db
    .select()
    .from(courseIntakes)
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Intake not found." };
  }

  try {
    await db.delete(courseIntakes).where(eq(courseIntakes.intakeId, intakeId));

    await auditDelete(user, "course_intakes", String(intakeId), {
      intakeNumber: existing.intakeNumber,
      year: existing.year,
    });

    revalidatePath("/intakes");
    revalidatePath(`/courses/${existing.courseId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
