"use server";

import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { presentations } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { auditCreate, auditDelete, auditUpdate } from "@/lib/utils/audit";
import {
  extensionForMime,
  resolveUnderRoot,
} from "@/lib/utils/security-path";
import {
  isPresentationCategory,
  type PresentationCategory,
} from "@/lib/utils/presentations";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "presentations");
const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function revalidatePresentationPaths(category?: string) {
  revalidatePath("/presentations");
  revalidatePath("/dashboard");
  if (category) revalidatePath(`/presentations/${category}`);
}

export async function uploadPresentation(formData: FormData) {
  const user = await requireRole(["admin", "instructor"]);

  const title = (formData.get("title") as string)?.trim();
  const categoryRaw = (formData.get("category") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const presenterName =
    (formData.get("presenterName") as string)?.trim() || null;
  const audience = (formData.get("audience") as string)?.trim() || null;
  const venue = (formData.get("venue") as string)?.trim() || null;
  const presentedAt = (formData.get("presentedAt") as string)?.trim() || null;
  const file = formData.get("file") as File | null;

  if (!title || title.length < 3) {
    return { success: false as const, error: "Title is required (min 3 characters)." };
  }
  if (!categoryRaw || !isPresentationCategory(categoryRaw)) {
    return { success: false as const, error: "Invalid presentation category." };
  }
  const category: PresentationCategory = categoryRaw;

  if (!file || file.size === 0) {
    return { success: false as const, error: "Please attach a presentation file." };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false as const,
      error: "File must be PDF, PowerPoint, or Word.",
    };
  }
  if (file.size > MAX_BYTES) {
    return { success: false as const, error: "File must be under 50 MB." };
  }

  const ext = extensionForMime(file.type);
  if (!ext) {
    return { success: false as const, error: "Unsupported file type." };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const safeBase = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const filename = `${category}-${safeBase || "brief"}-${Date.now()}${ext}`;
  const dest = resolveUnderRoot(UPLOAD_DIR, filename);
  if (!dest) {
    return { success: false as const, error: "Invalid upload path." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buffer);

  const [created] = await db
    .insert(presentations)
    .values({
      title: title.slice(0, 200),
      category,
      description,
      presenterName: presenterName?.slice(0, 120) ?? null,
      audience: audience?.slice(0, 200) ?? null,
      venue: venue?.slice(0, 200) ?? null,
      presentedAt: presentedAt || null,
      fileName: path.basename(file.name).slice(0, 200),
      filePath: `/presentations/${filename}`,
      fileSize: file.size,
      mimeType: file.type,
      uploadedBy: user.userId,
      isActive: true,
    })
    .returning({ id: presentations.id });

  await auditCreate(user, "presentations", String(created.id), {
    title,
    category,
    fileName: path.basename(file.name),
  });

  revalidatePresentationPaths(category);
  return { success: true as const, id: created.id };
}

export async function deletePresentation(presentationId: number) {
  const user = await requireRole(["admin", "instructor"]);

  const [row] = await db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .limit(1);
  if (!row) return { success: false as const, error: "Presentation not found." };

  if (user.role === "instructor" && row.uploadedBy !== user.userId) {
    return {
      success: false as const,
      error: "You can only delete presentations you uploaded.",
    };
  }

  const filename = path.basename(row.filePath);
  const diskPath = resolveUnderRoot(UPLOAD_DIR, filename);
  if (diskPath) {
    try {
      await unlink(diskPath);
    } catch {
      // file may already be gone
    }
  }

  await db.delete(presentations).where(eq(presentations.id, presentationId));
  await auditDelete(user, "presentations", String(presentationId), {
    title: row.title,
    category: row.category,
  });

  revalidatePresentationPaths(row.category);
  return { success: true as const };
}

export async function archivePresentation(presentationId: number) {
  const user = await requireRole(["admin", "instructor"]);
  const [row] = await db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .limit(1);
  if (!row) return { success: false as const, error: "Not found." };

  await db
    .update(presentations)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(presentations.id, presentationId)));

  await auditUpdate(
    user,
    "presentations",
    String(presentationId),
    { isActive: true },
    { isActive: false }
  );
  revalidatePresentationPaths(row.category);
  return { success: true as const };
}
