import { readFile } from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import {
  buildNoticePdfBuffer,
  noticePdfFilename,
  type NoticePdfData,
} from "./notice-pdf";
import { resolveUnderRoot } from "./security-path";

export interface NoticeDownloadRow {
  id: number;
  title: string;
  body: string;
  category: string;
  priority: string;
  isPinned: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  authorName: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
}

const NOTICE_STORAGE = path.join(process.cwd(), "storage", "course-notices");
const LEGACY_PUBLIC = path.join(process.cwd(), "public", "course-notices");

/** Resolve notice attachment on disk (private storage, then legacy public). */
export function resolveNoticeAttachmentPath(
  attachmentPath: string
): string | null {
  if (!attachmentPath.startsWith("/course-notices/")) return null;
  const filename = path.basename(attachmentPath);
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  return (
    resolveUnderRoot(NOTICE_STORAGE, filename) ??
    resolveUnderRoot(LEGACY_PUBLIC, filename)
  );
}

export function subjectZipFilename(courseCode: string, subjectName: string): string {
  const safe = (v: string) =>
    v.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-") || "notices";
  return `${safe(courseCode)}-${safe(subjectName)}-notices.zip`;
}

export async function buildSubjectNoticesZip(
  notices: NoticeDownloadRow[],
  context: {
    courseCode: string;
    courseName: string;
    subjectName: string;
  }
): Promise<Buffer> {
  const zip = new AdmZip();

  if (notices.length === 0) {
    zip.addFile(
      "README.txt",
      Buffer.from(
        `No active notices for ${context.subjectName} (${context.courseCode}).`,
        "utf-8"
      )
    );
    return zip.toBuffer();
  }

  for (let i = 0; i < notices.length; i++) {
    const notice = notices[i];
    const pdfData: NoticePdfData = {
      title: notice.title,
      body: notice.body,
      category: notice.category,
      priority: notice.priority,
      isPinned: notice.isPinned,
      createdAt: notice.createdAt,
      expiresAt: notice.expiresAt,
      authorName: notice.authorName,
      attachmentName: notice.attachmentName,
      courseCode: context.courseCode,
      courseName: context.courseName,
      subjectName: context.subjectName,
    };

    const pdfName = `${String(i + 1).padStart(2, "0")}-${noticePdfFilename(pdfData)}`;
    const pdfBuffer = await buildNoticePdfBuffer(pdfData);
    zip.addFile(pdfName, pdfBuffer);

    if (notice.attachmentPath) {
      const filePath = resolveNoticeAttachmentPath(notice.attachmentPath);
      if (!filePath) continue;
      try {
        const fileBuffer = await readFile(filePath);
        const attachmentName =
          notice.attachmentName ?? path.basename(notice.attachmentPath);
        const safeName = path.basename(attachmentName).replace(/[^\w.\- ()]/g, "_");
        zip.addFile(
          `attachments/${String(i + 1).padStart(2, "0")}-${safeName}`,
          fileBuffer
        );
      } catch {
        // attachment missing on disk
      }
    }
  }

  return zip.toBuffer();
}
