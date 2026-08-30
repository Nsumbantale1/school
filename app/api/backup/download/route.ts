import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { auditCreate } from "@/lib/utils/audit";
import { BACKUP_TABLE } from "@/lib/utils/backup-tracker";
import {
  createBackupZip,
  formatBackupTimestamp,
} from "@/lib/utils/backup-core";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const buffer = await createBackupZip(process.cwd());
    const filename = `SOFA-backup-${formatBackupTimestamp()}`;

    await auditCreate(user, BACKUP_TABLE, filename, {
      filename: `${filename}.zip`,
      sizeBytes: buffer.length,
      source: "ui_download",
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}.zip"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Backup download failed:", error);
    return NextResponse.json(
      { error: "Failed to create backup. Check server logs." },
      { status: 500 }
    );
  }
}
