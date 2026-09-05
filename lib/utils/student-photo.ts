import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export const STUDENT_PHOTOS_DIR = path.join(
  process.cwd(),
  "public",
  "student-photos"
);

export const STUDENT_PHOTO_DESCRIPTION = "Student photograph";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/jpg"];

export function photoFileSafeId(armyNumber: string): string {
  return armyNumber.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function saveStudentPhoto(
  armyNumber: string,
  file: File
): Promise<{ path: string; fileName: string; fileType: string; fileSize: number } | { error: string }> {
  if (!file || file.size === 0) {
    return { error: "Please choose a photo." };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Photo must be PNG, JPEG, or WebP." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Photo must be smaller than 3 MB." };
  }

  await mkdir(STUDENT_PHOTOS_DIR, { recursive: true });

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const fileName = `${photoFileSafeId(armyNumber)}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(STUDENT_PHOTOS_DIR, fileName), buffer);

  return {
    path: `/student-photos/${fileName}`,
    fileName,
    fileType: ext,
    fileSize: file.size,
  };
}

export async function removeStudentPhotoFile(photoPath: string | null | undefined) {
  if (!photoPath || !photoPath.startsWith("/student-photos/")) return;
  const filename = path.basename(photoPath);
  try {
    await unlink(path.join(STUDENT_PHOTOS_DIR, filename));
  } catch {
    // already gone
  }
}

export async function getStudentPhotoPath(
  armyNumber: string
): Promise<string | null> {
  const [row] = await db
    .select({ filePath: documents.filePath })
    .from(documents)
    .where(
      and(
        eq(documents.studentArmyNumber, armyNumber),
        eq(documents.description, STUDENT_PHOTO_DESCRIPTION)
      )
    )
    .orderBy(desc(documents.createdAt))
    .limit(1);
  return row?.filePath ?? null;
}

export async function getStudentPhotoPathMap(
  armyNumbers: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (armyNumbers.length === 0) return map;

  const rows = await db
    .select({
      armyNumber: documents.studentArmyNumber,
      filePath: documents.filePath,
    })
    .from(documents)
    .where(
      and(
        inArray(documents.studentArmyNumber, armyNumbers),
        eq(documents.description, STUDENT_PHOTO_DESCRIPTION)
      )
    )
    .orderBy(desc(documents.createdAt));

  for (const row of rows) {
    if (row.armyNumber && !map.has(row.armyNumber)) {
      map.set(row.armyNumber, row.filePath);
    }
  }
  return map;
}

export async function replaceStudentPhotoDocument(opts: {
  armyNumber: string;
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: number;
}) {
  const existing = await db
    .select({
      documentId: documents.documentId,
      filePath: documents.filePath,
    })
    .from(documents)
    .where(
      and(
        eq(documents.studentArmyNumber, opts.armyNumber),
        eq(documents.description, STUDENT_PHOTO_DESCRIPTION)
      )
    );

  for (const row of existing) {
    await removeStudentPhotoFile(row.filePath);
    await db.delete(documents).where(eq(documents.documentId, row.documentId));
  }

  await db.insert(documents).values({
    studentArmyNumber: opts.armyNumber,
    fileName: opts.fileName,
    fileType: opts.fileType,
    fileSize: opts.fileSize,
    filePath: opts.filePath,
    description: STUDENT_PHOTO_DESCRIPTION,
    uploadedBy: opts.uploadedBy,
  });
}
