"use server";

import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole, requireAuth } from "@/lib/auth/guards";
import { auditCreate, auditUpdate, auditDelete, getChangedFields } from "@/lib/utils/audit";

export async function createStudent(formData: FormData) {
  const user = await requireRole(["admin"]);

  const armyNumber = formData.get("armyNumber") as string;
  const fullName = formData.get("fullName") as string;
  const rank = formData.get("rank") as string;
  const gender = formData.get("gender") as "male" | "female";
  const dateOfBirth = (formData.get("dateOfBirth") as string) || null;
  const unit = (formData.get("unit") as string) || null;
  const phone = (formData.get("phone") as string) || null;
  const email = (formData.get("email") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  try {
    await db.insert(students).values({
      armyNumber,
      fullName,
      rank,
      gender,
      dateOfBirth,
      unit,
      phone,
      email,
      notes,
    });

    await auditCreate(user, "students", armyNumber, {
      armyNumber,
      fullName,
      rank,
      gender,
      dateOfBirth,
      unit,
      phone,
      email,
    });

    revalidatePath("/students");
    return { success: true };
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("duplicate key")) {
      return { success: false, error: "A student with this Army Number already exists." };
    }
    return { success: false, error: message };
  }
}

export async function updateStudent(armyNumber: string, formData: FormData) {
  const user = await requireRole(["admin"]);

  // Get current data for audit
  const [existing] = await db
    .select()
    .from(students)
    .where(eq(students.armyNumber, armyNumber))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Student not found." };
  }

  const newData = {
    fullName: formData.get("fullName") as string,
    rank: formData.get("rank") as string,
    gender: formData.get("gender") as "male" | "female",
    dateOfBirth: (formData.get("dateOfBirth") as string) || null,
    unit: (formData.get("unit") as string) || null,
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    notes: (formData.get("notes") as string) || null,
    updatedAt: new Date(),
  };

  try {
    await db
      .update(students)
      .set(newData)
      .where(eq(students.armyNumber, armyNumber));

    const changes = getChangedFields(existing, newData);
    await auditUpdate(user, "students", armyNumber, changes.old, changes.new);

    revalidatePath("/students");
    revalidatePath(`/students/${encodeURIComponent(armyNumber)}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteStudent(armyNumber: string) {
  const user = await requireRole(["admin"]);

  // Get current data for audit
  const [existing] = await db
    .select()
    .from(students)
    .where(eq(students.armyNumber, armyNumber))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Student not found." };
  }

  try {
    // Soft delete
    await db
      .update(students)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(students.armyNumber, armyNumber));

    await auditDelete(user, "students", armyNumber, {
      armyNumber: existing.armyNumber,
      fullName: existing.fullName,
    });

    revalidatePath("/students");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreStudent(armyNumber: string) {
  const user = await requireRole(["admin"]);

  try {
    await db
      .update(students)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(students.armyNumber, armyNumber));

    await auditUpdate(
      user,
      "students",
      armyNumber,
      { isActive: false },
      { isActive: true }
    );

    revalidatePath("/students");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
