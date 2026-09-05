import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseNotices } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { resolveNoticeAttachmentPath } from "@/lib/utils/notice-download";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ noticeId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { noticeId } = await params;
  const id = parseInt(noticeId);
  if (!id) {
    return NextResponse.json({ error: "Invalid notice" }, { status: 400 });
  }

  const [row] = await db
    .select({
      attachmentPath: courseNotices.attachmentPath,
      attachmentName: courseNotices.attachmentName,
    })
    .from(courseNotices)
    .where(eq(courseNotices.id, id))
    .limit(1);

  if (!row?.attachmentPath) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const diskPath = resolveNoticeAttachmentPath(row.attachmentPath);
  if (!diskPath) {
    return NextResponse.json({ error: "Invalid attachment path" }, { status: 400 });
  }

  try {
    const buffer = await readFile(diskPath);
    const ext = path.extname(diskPath).toLowerCase();
    const filename =
      path.basename(row.attachmentName ?? path.basename(diskPath)) ||
      "attachment";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Attachment missing on disk" }, { status: 404 });
  }
}
