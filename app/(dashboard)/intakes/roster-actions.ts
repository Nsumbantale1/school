"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { auditCreate } from "@/lib/utils/audit";
import { parseRosterFile, normalizeRosterArmyNumber, type RosterRow } from "@/lib/utils/roster-parse";
import { analyzeRoster, enrollRoster } from "@/lib/utils/intake-roster";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Reads an uploaded roll and returns what would happen to each student. */
export async function previewRosterUpload(intakeId: number, formData: FormData) {
  await requireRole(["admin"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false as const, error: "Choose an Excel, Word or PDF file." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { success: false as const, error: "File is larger than 10 MB." };
  }

  let parsed;
  try {
    parsed = await parseRosterFile(file.name, new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
  if (parsed.rows.length === 0) {
    return {
      success: false as const,
      error:
        parsed.warnings[0] ??
        "No students found. The file needs a column with army numbers (e.g. MT 123456).",
    };
  }

  const analysis = await analyzeRoster(intakeId, parsed.rows);
  if ("error" in analysis) return { success: false as const, error: analysis.error };
  return {
    success: true as const,
    source: parsed.source,
    warnings: parsed.warnings,
    rows: analysis.rows,
  };
}

/** Re-checks rows after the admin edited them in the preview. */
export async function previewRosterRows(intakeId: number, rows: RosterRow[]) {
  await requireRole(["admin"]);
  const analysis = await analyzeRoster(intakeId, rows);
  if ("error" in analysis) return { success: false as const, error: analysis.error };
  return { success: true as const, rows: analysis.rows };
}

export async function enrollRosterRows(intakeId: number, rows: RosterRow[]) {
  const user = await requireRole(["admin"]);
  const summary = await enrollRoster(intakeId, rows);
  if ("error" in summary) return { success: false as const, error: summary.error };

  if (summary.enrolled > 0) {
    await auditCreate(user, "enrollments", `intake:${intakeId}`, {
      action: "roster_import",
      enrolled: summary.enrolled,
      newStudents: summary.newStudents,
      namesUpdated: summary.namesUpdated,
      armyNumbers: rows.map((r) => r.armyNumber).slice(0, 200),
    });
  }

  revalidatePath(`/intakes/${intakeId}`);
  revalidatePath("/intakes");
  revalidatePath("/enrollments");
  revalidatePath("/students");
  return { success: true as const, ...summary };
}

/** Prefills the single-student form when the army number is already in SOFA. */
export async function findStudentForRoster(armyNumber: string) {
  await requireRole(["admin"]);
  const normalized = normalizeRosterArmyNumber(armyNumber);
  if (!normalized) {
    return { success: false as const, error: "Enter a valid army number (e.g. MT 123456)." };
  }
  const [student] = await db
    .select({
      armyNumber: students.armyNumber,
      fullName: students.fullName,
      rank: students.rank,
      unit: students.unit,
      gender: students.gender,
    })
    .from(students)
    .where(eq(students.armyNumber, normalized))
    .limit(1);
  return { success: true as const, armyNumber: normalized, student: student ?? null };
}
