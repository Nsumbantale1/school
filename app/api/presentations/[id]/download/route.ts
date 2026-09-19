import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { presentations } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { resolveUnderRoot } from "@/lib/utils/security-path";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "presentations");

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const presentationId = parseInt(id, 10);
  if (!Number.isFinite(presentationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .limit(1);
  if (!row || !row.isActive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = path.basename(row.filePath);
  const diskPath = resolveUnderRoot(UPLOAD_DIR, filename);
  if (!diskPath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const data = await readFile(diskPath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": row.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${row.fileName.replace(/"/g, "")}"`,
        "Content-Length": String(data.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }
}
