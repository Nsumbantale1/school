"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import {
  parseBackupZip,
  restoreBackup,
  createBackupBundle,
} from "@/lib/utils/backup-core";

const MAX_BACKUP_BYTES = 100 * 1024 * 1024; // 100 MB

export async function getBackupSummary() {
  await requireRole(["admin"]);

  try {
    const bundle = await createBackupBundle(process.cwd());
    return {
      success: true as const,
      summary: {
        createdAt: bundle.manifest.createdAt,
        tables: bundle.manifest.tables.length,
        totalRows: bundle.manifest.totalRows,
        hasSignatures: bundle.manifest.files.signatures,
        publicAssets: bundle.manifest.files.publicAssets,
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "Could not read backup summary.",
    };
  }
}

export async function restoreFromBackupFile(formData: FormData) {
  await requireRole(["admin"]);

  const file = formData.get("backup") as File | null;
  const includeEnv = formData.get("includeEnv") === "true";

  if (!file || file.size === 0) {
    return { success: false, error: "Please select a backup .zip file." };
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    return { success: false, error: "Backup file must be a .zip archive." };
  }

  if (file.size > MAX_BACKUP_BYTES) {
    return {
      success: false,
      error: "Backup file is too large (max 100 MB).",
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseBackupZip(buffer);

    await restoreBackup(process.cwd(), {
      database: parsed.database,
      files: parsed.files,
      envSnapshot: includeEnv ? parsed.envSnapshot : undefined,
    });

    revalidatePath("/", "layout");

    return {
      success: true,
      message: `Restored ${parsed.manifest.totalRows} rows from backup dated ${new Date(parsed.manifest.createdAt).toLocaleString("en-GB")}.`,
    };
  } catch (error) {
    console.error("Restore failed:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Restore failed. Check the backup file and try again.",
    };
  }
}
