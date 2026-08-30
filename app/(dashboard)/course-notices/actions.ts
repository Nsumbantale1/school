"use server";

import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { courseNotices, courseExercises } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/guards";

const UPLOAD_DIR = path.join(process.cwd(), "public", "course-notices");
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function revalidateSubject(courseId: number, subjectId: number) {
  revalidatePath("/course-notices");
  revalidatePath(`/course-notices/${courseId}`);
  revalidatePath(`/course-notices/${courseId}/${subjectId}`);
}

function revalidateCourse(courseId: number) {
  revalidatePath("/course-notices");
  revalidatePath(`/course-notices/${courseId}`);
}

export async function createCourseNotice(formData: FormData) {
  const user = await requireRole(["admin", "instructor"]);

  const courseId = parseInt(formData.get("courseId") as string);
  const subjectId = parseInt(formData.get("subjectId") as string);
  const title = (formData.get("title") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  const category = (formData.get("category") as string) || "general";
  const priority = (formData.get("priority") as string) || "normal";
  const isPinned = formData.get("isPinned") === "on";
  const expiresAtRaw = (formData.get("expiresAt") as string)?.trim();
  const file = formData.get("attachment") as File | null;

  if (!courseId || !subjectId || !title || !body) {
    return { success: false, error: "Title and message are required." };
  }

  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;

  if (file && file.size > 0) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false,
        error: "Attachment must be PDF, image, Word, or Excel.",
      };
    }
    if (file.size > MAX_BYTES) {
      return { success: false, error: "Attachment must be under 10 MB." };
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(file.name) || ".bin";
    const filename = `notice-${courseId}-${subjectId}-${Date.now()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);
    attachmentPath = `/course-notices/${filename}`;
    attachmentName = file.name;
  }

  await db.insert(courseNotices).values({
    courseId,
    subjectId,
    title,
    body,
    category: category as "general" | "schedule" | "safety" | "exam" | "admin",
    priority: priority as "normal" | "important" | "urgent",
    isPinned,
    expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
    attachmentPath,
    attachmentName,
    createdBy: user.userId,
  });

  revalidateSubject(courseId, subjectId);
  return { success: true };
}

export async function deleteCourseNotice(
  noticeId: number,
  courseId: number,
  subjectId: number
) {
  await requireRole(["admin", "instructor"]);

  const [row] = await db
    .select()
    .from(courseNotices)
    .where(eq(courseNotices.id, noticeId))
    .limit(1);

  if (row?.attachmentPath?.startsWith("/course-notices/")) {
    try {
      await unlink(
        path.join(process.cwd(), "public", row.attachmentPath)
      );
    } catch {
      // ignore
    }
  }

  await db.delete(courseNotices).where(eq(courseNotices.id, noticeId));
  revalidateSubject(courseId, subjectId);
  return { success: true };
}

export async function createCourseExercise(formData: FormData) {
  const user = await requireRole(["admin", "instructor"]);

  const courseId = parseInt(formData.get("courseId") as string);
  const weekNumber = parseInt(formData.get("weekNumber") as string);
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const exerciseType = (formData.get("exerciseType") as string) || "other";
  const location = (formData.get("location") as string)?.trim() || null;
  const duration = (formData.get("duration") as string)?.trim() || null;

  if (!courseId || !weekNumber || !title) {
    return { success: false, error: "Week number and title are required." };
  }

  await db.insert(courseExercises).values({
    courseId,
    weekNumber,
    title,
    description,
    exerciseType: exerciseType as
      | "theory"
      | "practical"
      | "firing"
      | "pt"
      | "field"
      | "assessment"
      | "drill"
      | "other",
    location,
    duration,
    createdBy: user.userId,
  });

  revalidateCourse(courseId);
  return { success: true };
}

export async function deleteCourseExercise(exerciseId: number, courseId: number) {
  await requireRole(["admin", "instructor"]);

  await db.delete(courseExercises).where(eq(courseExercises.id, exerciseId));
  revalidateCourse(courseId);
  return { success: true };
}
