export interface NoticePdfData {
  title: string;
  body: string;
  category: string;
  priority: string;
  isPinned: boolean;
  createdAt: Date | string;
  expiresAt?: Date | string | null;
  authorName?: string | null;
  attachmentName?: string | null;
  courseCode: string;
  courseName: string;
  subjectName: string;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function safeFilename(value: string, max = 60): string {
  return value
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, max) || "notice";
}

export function noticePdfFilename(data: NoticePdfData): string {
  return `${safeFilename(data.courseCode)}-${safeFilename(data.subjectName)}-${safeFilename(data.title)}.pdf`;
}

export async function buildNoticePdfBuffer(data: NoticePdfData): Promise<Buffer> {
  const { default: jsPDF } = await import("jspdf");
  const { readFile } = await import("fs/promises");
  const path = await import("path");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  try {
    const logoPath = path.join(process.cwd(), "public", "school-of-artillery.png");
    const logoBytes = await readFile(logoPath);
    const logoBase64 = `data:image/png;base64,${logoBytes.toString("base64")}`;
    doc.addImage(logoBase64, "PNG", margin, y, 22, 17);
  } catch {
    // optional logo
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("SCHOOL OF FIELD ARTILLERY", margin + 26, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Course Subject Notice", margin + 26, y + 12);
  y += 24;

  doc.setDrawColor(30, 140, 60);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(data.title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const meta = [
    `Course: ${data.courseCode} — ${data.courseName}`,
    `Subject: ${data.subjectName}`,
    `Category: ${labelize(data.category)}`,
    `Priority: ${labelize(data.priority)}${data.isPinned ? " · Pinned" : ""}`,
    `Published: ${formatDateTime(data.createdAt)}${data.authorName ? ` by ${data.authorName}` : ""}`,
    data.expiresAt ? `Expires: ${formatDate(data.expiresAt)}` : null,
    data.attachmentName ? `Attachment on file: ${data.attachmentName}` : null,
  ].filter(Boolean) as string[];

  for (const line of meta) {
    doc.text(line, margin, y);
    y += 5;
  }
  y += 4;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(11);
  const bodyLines = doc.splitTextToSize(data.body, contentWidth);
  const pageHeight = doc.internal.pageSize.getHeight();

  for (const line of bodyLines) {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, margin, y);
    y += 6;
  }

  const footerY = pageHeight - 10;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generated ${formatDateTime(new Date())} — School of Field Artillery`,
    margin,
    footerY
  );

  return Buffer.from(doc.output("arraybuffer"));
}
