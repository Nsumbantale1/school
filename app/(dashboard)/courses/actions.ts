"use server";

import { db } from "@/lib/db";
import { courses, coursePrerequisites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { auditCreate, auditUpdate, auditDelete, getChangedFields } from "@/lib/utils/audit";

export async function createCourse(formData: FormData) {
  const user = await requireRole(["admin"]);

  const courseCode = formData.get("courseCode") as string;
  const courseName = formData.get("courseName") as string;
  const durationWeeks = parseInt(formData.get("durationWeeks") as string);
  const passingMark = parseInt(formData.get("passingMark") as string) || 40;
  const description = (formData.get("description") as string) || null;

  try {
    const [newCourse] = await db
      .insert(courses)
      .values({
        courseCode,
        courseName,
        durationWeeks,
        passingMark,
        description,
      })
      .returning({ courseId: courses.courseId });

    await auditCreate(user, "courses", String(newCourse.courseId), {
      courseCode,
      courseName,
      durationWeeks,
      passingMark,
    });

    revalidatePath("/courses");
    return { success: true, courseId: newCourse.courseId };
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("duplicate key")) {
      return { success: false, error: "A course with this code already exists." };
    }
    return { success: false, error: message };
  }
}

export async function updateCourse(courseId: number, formData: FormData) {
  const user = await requireRole(["admin"]);

  // Get existing data for audit
  const [existing] = await db
    .select()
    .from(courses)
    .where(eq(courses.courseId, courseId))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Course not found." };
  }

  const newData = {
    courseCode: formData.get("courseCode") as string,
    courseName: formData.get("courseName") as string,
    durationWeeks: parseInt(formData.get("durationWeeks") as string),
    passingMark: parseInt(formData.get("passingMark") as string) || 40,
    description: (formData.get("description") as string) || null,
    updatedAt: new Date(),
  };

  try {
    await db
      .update(courses)
      .set(newData)
      .where(eq(courses.courseId, courseId));

    const changes = getChangedFields(existing, newData);
    await auditUpdate(user, "courses", String(courseId), changes.old, changes.new);

    revalidatePath("/courses");
    revalidatePath(`/courses/${courseId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteCourse(courseId: number) {
  const user = await requireRole(["admin"]);

  const [existing] = await db
    .select()
    .from(courses)
    .where(eq(courses.courseId, courseId))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Course not found." };
  }

  try {
    await db
      .update(courses)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(courses.courseId, courseId));

    await auditDelete(user, "courses", String(courseId), {
      courseCode: existing.courseCode,
      courseName: existing.courseName,
    });

    revalidatePath("/courses");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function addPrerequisite(
  courseId: number,
  prerequisiteCourseId: number,
  isOptional: boolean = false
) {
  const user = await requireRole(["admin"]);

  if (courseId === prerequisiteCourseId) {
    return { success: false, error: "A course cannot be its own prerequisite." };
  }

  try {
    await db.insert(coursePrerequisites).values({
      courseId,
      prerequisiteCourseId,
      isOptional,
    });

    await auditCreate(user, "course_prerequisites", `${courseId}-${prerequisiteCourseId}`, {
      courseId,
      prerequisiteCourseId,
      isOptional,
    });

    revalidatePath(`/courses/${courseId}`);
    return { success: true };
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("duplicate key")) {
      return { success: false, error: "This prerequisite already exists." };
    }
    return { success: false, error: message };
  }
}

export async function removePrerequisite(courseId: number, prerequisiteCourseId: number) {
  const user = await requireRole(["admin"]);

  try {
    await db
      .delete(coursePrerequisites)
      .where(
        eq(coursePrerequisites.courseId, courseId)
      );

    await auditDelete(user, "course_prerequisites", `${courseId}-${prerequisiteCourseId}`, {
      courseId,
      prerequisiteCourseId,
    });

    revalidatePath(`/courses/${courseId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
