"use server";

import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { officialSignatures } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/guards";

const SIGNATURES_DIR = path.join(process.cwd(), "public", "signatures");
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function uploadOfficialSignature(formData: FormData) {
  await requireRole(["admin"]);

  const role = formData.get("role") as "chief_instructor" | "commandant";
  const fullName = (formData.get("fullName") as string)?.trim() || null;
  const rankTitle = (formData.get("rankTitle") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const file = formData.get("signature") as File | null;

  if (!role || !["chief_instructor", "commandant"].includes(role)) {
    return { success: false, error: "Invalid role." };
  }

  if (!file || file.size === 0) {
    return { success: false, error: "Please select a signature image to upload." };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      error: "Only PNG, JPEG, or WebP images are allowed.",
    };
  }

  if (file.size > MAX_BYTES) {
    return { success: false, error: "Image must be smaller than 2 MB." };
  }

  await mkdir(SIGNATURES_DIR, { recursive: true });

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const filename = `${role}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(SIGNATURES_DIR, filename), buffer);
  const publicPath = `/signatures/${filename}`;

  await db
    .update(officialSignatures)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(officialSignatures.role, role),
        eq(officialSignatures.isActive, true)
      )
    );

  await db.insert(officialSignatures).values({
    role,
    fullName,
    rankTitle,
    signatureImagePath: publicPath,
    notes,
    isActive: true,
  });

  revalidatePath("/settings/signatures");
  return { success: true };
}

export async function deleteOfficialSignature(id: number) {
  await requireRole(["admin"]);

  if (!id) return { success: false, error: "Invalid record." };

  const [row] = await db
    .select()
    .from(officialSignatures)
    .where(eq(officialSignatures.id, id))
    .limit(1);

  if (!row) return { success: false, error: "Signature not found." };

  await db
    .update(officialSignatures)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(officialSignatures.id, id));

  if (row.signatureImagePath?.startsWith("/signatures/")) {
    const filePath = path.join(process.cwd(), "public", row.signatureImagePath);
    try {
      await unlink(filePath);
    } catch {
      // File may already be missing — safe to ignore
    }
  }

  revalidatePath("/settings/signatures");
  return { success: true };
}

export async function updateOfficialDetails(formData: FormData) {
  await requireRole(["admin"]);

  const id = parseInt(formData.get("id") as string);
  const fullName = (formData.get("fullName") as string)?.trim() || null;
  const rankTitle = (formData.get("rankTitle") as string)?.trim() || null;

  if (!id) return { success: false, error: "Invalid record." };

  await db
    .update(officialSignatures)
    .set({ fullName, rankTitle, updatedAt: new Date() })
    .where(eq(officialSignatures.id, id));

  revalidatePath("/settings/signatures");
  return { success: true };
}
