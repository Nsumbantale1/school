"use server";

import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  courseNotices,
  courseExercises,
  courseSubjects,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  assertCanAccessCourse,
  requireRole,
} from "@/lib/auth/guards";
import { auditCreate, auditDelete } from "@/lib/utils/audit";
import {
  extensionForMime,
  resolveUnderRoot,
} from "@/lib/utils/security-path";

const GENERAL_SUBJECT = "General Notices";

/** Ensure course has a default subject so notices can always be uploaded. */
export async function ensureGeneralNoticeSubject(
  courseId: number
): Promise<number> {
  const [existing] = await db
    .select({ subjectId: courseSubjects.subjectId })
    .from(courseSubjects)
    .where(
      and(
        eq(courseSubjects.courseId, courseId),
        eq(courseSubjects.subjectName, GENERAL_SUBJECT)
      )
    )
    .limit(1);
  if (existing) return existing.subjectId;

  const [anySubject] = await db
    .select({ subjectId: courseSubjects.subjectId })
    .from(courseSubjects)
    .where(eq(courseSubjects.courseId, courseId))
    .limit(1);
  if (anySubject) return anySubject.subjectId;

  const [created] = await db
    .insert(courseSubjects)
    .values({
      courseId,
      subjectName: GENERAL_SUBJECT,
      maxMarks: "100",
      sortOrder: 0,
    })
    .returning({ subjectId: courseSubjects.subjectId });
  return created.subjectId;
}

const UPLOAD_DIR = path.join(process.cwd(), "storage", "course-notices");
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

function resolveNoticeAttachment(attachmentPath: string): string | null {
  if (!attachmentPath.startsWith("/course-notices/")) return null;
  const filename = path.basename(attachmentPath);
  if (filename !== attachmentPath.replace(/^\/course-notices\//, "")) {
    return null;
  }
  return resolveUnderRoot(UPLOAD_DIR, filename);
}

export async function createCourseNotice(formData: FormData) {
  const user = await requireRole(["admin", "instructor"]);

  const courseId = parseInt(formData.get("courseId") as string);
  let subjectId = parseInt(formData.get("subjectId") as string);
  const title = (formData.get("title") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  const category = (formData.get("category") as string) || "general";
  const priority = (formData.get("priority") as string) || "normal";
  const isPinned = formData.get("isPinned") === "on";
  const expiresAtRaw = (formData.get("expiresAt") as string)?.trim();
  const file = formData.get("attachment") as File | null;

  if (!courseId || !title || !body) {
    return { success: false, error: "Title and message are required." };
  }

  if (!assertCanAccessCourse(user, courseId)) {
    return {
      success: false,
      error: "You can only manage notices for your assigned course.",
    };
  }

  if (!subjectId) {
    subjectId = await ensureGeneralNoticeSubject(courseId);
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

    const ext = extensionForMime(file.type);
    if (!ext) {
      return { success: false, error: "Unsupported attachment type." };
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `notice-${courseId}-${subjectId}-${Date.now()}${ext}`;
    const dest = resolveUnderRoot(UPLOAD_DIR, filename);
    if (!dest) {
      return { success: false, error: "Invalid upload path." };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(dest, buffer);
    // Logical path (not public URL) — served via authenticated API.
    attachmentPath = `/course-notices/${filename}`;
    attachmentName = path.basename(file.name).slice(0, 200);
  }

  const [created] = await db
    .insert(courseNotices)
    .values({
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
    })
    .returning({ id: courseNotices.id });

  await auditCreate(user, "course_notices", String(created.id), {
    title,
    courseId,
    subjectId,
    category,
    priority,
    attachmentName,
  });

  revalidateSubject(courseId, subjectId);
  return { success: true };
}

export async function deleteCourseNotice(
  noticeId: number,
  courseId: number,
  subjectId: number
) {
  const user = await requireRole(["admin", "instructor"]);

  if (!assertCanAccessCourse(user, courseId)) {
    return {
      success: false,
      error: "You can only manage notices for your assigned course.",
    };
  }

  const [row] = await db
    .select()
    .from(courseNotices)
    .where(eq(courseNotices.id, noticeId))
    .limit(1);

  if (row && row.courseId !== courseId) {
    return { success: false, error: "Notice does not belong to this course." };
  }

  if (row?.attachmentPath) {
    const diskPath = resolveNoticeAttachment(row.attachmentPath);
    if (diskPath) {
      try {
        await unlink(diskPath);
      } catch {
        // ignore
      }
    }
  }

  await db.delete(courseNotices).where(eq(courseNotices.id, noticeId));

  if (row) {
    await auditDelete(user, "course_notices", String(noticeId), {
      title: row.title,
      courseId: row.courseId,
      subjectId: row.subjectId,
    });
  }

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

  if (!assertCanAccessCourse(user, courseId)) {
    return {
      success: false,
      error: "You can only manage exercises for your assigned course.",
    };
  }

  const [created] = await db
    .insert(courseExercises)
    .values({
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
    })
    .returning({ id: courseExercises.id });

  await auditCreate(user, "course_exercises", String(created.id), {
    title,
    courseId,
    weekNumber,
    exerciseType,
  });

  revalidateCourse(courseId);
  return { success: true };
}

export async function deleteCourseExercise(exerciseId: number, courseId: number) {
  const user = await requireRole(["admin", "instructor"]);

  if (!assertCanAccessCourse(user, courseId)) {
    return {
      success: false,
      error: "You can only manage exercises for your assigned course.",
    };
  }

  const [row] = await db
    .select()
    .from(courseExercises)
    .where(eq(courseExercises.id, exerciseId))
    .limit(1);

  if (row && row.courseId !== courseId) {
    return { success: false, error: "Exercise does not belong to this course." };
  }

  await db.delete(courseExercises).where(eq(courseExercises.id, exerciseId));

  if (row) {
    await auditDelete(user, "course_exercises", String(exerciseId), {
      title: row.title,
      courseId: row.courseId,
      weekNumber: row.weekNumber,
    });
  }

  revalidateCourse(courseId);
  return { success: true };
}
