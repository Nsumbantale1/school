import type { StudentServiceRecord } from "./student-service-record";

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const GREEN: [number, number, number] = [30, 140, 60];
const SCHOOL_LOGO_PATH = "/school-of-artillery.png";

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch(SCHOOL_LOGO_PATH);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addPageWatermark(
  doc: import("jspdf").jsPDF,
  logoDataUrl: string
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const size = Math.min(pageWidth, pageHeight) * 0.55;
  const x = (pageWidth - size) / 2;
  const y = (pageHeight - size) / 2;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gState = new (doc as any).GState({ opacity: 0.08 });
  doc.saveGraphicsState();
  doc.setGState(gState);
  doc.addImage(logoDataUrl, "PNG", x, y, size, size, undefined, "FAST");
  doc.restoreGraphicsState();
}

export async function downloadServiceRecordPdf(
  record: StudentServiceRecord
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logoDataUrl = await loadLogoDataUrl();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 14;

  const stampWatermark = () => {
    if (logoDataUrl) addPageWatermark(doc, logoDataUrl);
  };

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  const sectionTitle = (title: string) => {
    addPageIfNeeded(12);
    doc.setFillColor(...GREEN);
    doc.rect(margin, y, pageWidth - margin * 2, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 2, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 10;
  };

  // Official header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(
    "TANZANIA PEOPLE'S DEFENCE FORCE",
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 7;
  doc.text("SCHOOL OF FIELD ARTILLERY", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(10);
  doc.text("STUDENT TRAINING RECORD", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Reference: ${record.referenceNumber}`, margin, y);
  doc.text(
    `Generated: ${formatDate(record.generatedAt)}`,
    pageWidth - margin,
    y,
    { align: "right" }
  );
  y += 8;

  // Student identity
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${record.student.rank} ${record.student.fullName}`,
    margin,
    y
  );
  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Army Number: ${record.student.armyNumber}`, margin, y);
  y += 8;

  if (record.activeBan.blocked) {
    addPageIfNeeded(15);
    doc.setFillColor(254, 226, 226);
    doc.rect(margin, y, pageWidth - margin * 2, 12, "F");
    doc.setTextColor(180, 0, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("ACTIVE INDISCIPLINE BAN", margin + 2, y + 4);
    doc.setFont("helvetica", "normal");
    const banLines = doc.splitTextToSize(
      record.activeBan.message,
      pageWidth - margin * 2 - 4
    );
    doc.text(banLines, margin + 2, y + 8);
    doc.setTextColor(0, 0, 0);
    y += 14;
  }

  // Personal details
  sectionTitle("PERSONAL DETAILS");
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5 },
    body: [
      ["Current Rank", record.student.rank, "Gender", record.student.gender],
      [
        "Date of Birth",
        formatDate(record.student.dateOfBirth),
        "Status",
        record.student.isActive ? "Active" : "Inactive",
      ],
      ["Unit", record.student.unit ?? "—", "Phone", record.student.phone ?? "—"],
      ["Email", record.student.email ?? "—", "", ""],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 35 },
      2: { fontStyle: "bold", cellWidth: 35 },
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY + 6;

  // Service summary
  sectionTitle("SERVICE SUMMARY");
  const { summary } = record;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
      [
        "Total",
        "Passed",
        "Failed",
        "Incomplete",
        "Indiscipline",
        "Enrolled",
        "In Progress",
        "Results",
      ],
    ],
    body: [
      [
        String(summary.totalCourses),
        String(summary.passed),
        String(summary.failed),
        String(summary.incomplete),
        String(summary.indiscipline),
        String(summary.enrolled),
        String(summary.inProgress),
        String(summary.subjectResults),
      ],
    ],
    styles: { fontSize: 9, halign: "center", cellPadding: 2 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY + 6;

  // Course history (full)
  if (record.enrollments.length > 0) {
    sectionTitle("COURSE HISTORY");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [
        [
          "Course",
          "Intake",
          "Year",
          "Rank",
          "Unit",
          "Status",
          "Avg %",
          "Grade",
          "Pos.",
        ],
      ],
      body: record.enrollments.map((e) => [
        e.courseCode,
        e.intakeNumber,
        String(e.year),
        e.rankAtEnrollment,
        e.unitAtEnrollment ?? "—",
        statusLabel(e.status),
        e.averageMarks ? `${parseFloat(e.averageMarks).toFixed(1)}%` : "—",
        e.grade ?? "—",
        e.position != null ? String(e.position) : "—",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 6;
  }

  // Indiscipline history
  if (record.indisciplineHistory.length > 0) {
    sectionTitle("INDISCIPLINE RECORD");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [
        ["Course", "Intake", "Year", "Ceased", "Eligible After", "Ban"],
      ],
      body: record.indisciplineHistory.map((inc) => [
        `${inc.courseCode} — ${inc.courseName}`,
        inc.intakeNumber,
        String(inc.year),
        formatDate(inc.ceasedAt),
        formatDate(inc.eligibleAfter),
        inc.isActive ? "Active" : "Expired",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [120, 40, 120], textColor: 255, fontStyle: "bold" },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 6;
  }

  // Subject marks per course
  for (const enrollment of record.enrollments) {
    if (enrollment.subjects.length === 0) continue;

    addPageIfNeeded(20);
    sectionTitle(`SUBJECT MARKS — ${enrollment.courseCode}`);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(
      `${enrollment.courseName} · ${enrollment.intakeNumber} (${enrollment.year}) · Rank: ${enrollment.rankAtEnrollment}`,
      margin,
      y
    );
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Subject", "Marks", "%", "Grade", "Remarks"]],
      body: enrollment.subjects.map((s) => [
        s.subjectName,
        `${s.marksObtained}/${s.maxMarks}`,
        `${s.percentage.toFixed(1)}%`,
        s.grade ?? "—",
        s.remarks ?? "—",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 6;
  }

  if (record.student.notes) {
    addPageIfNeeded(15);
    sectionTitle("ADMINISTRATIVE NOTES");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(
      record.student.notes,
      pageWidth - margin * 2
    );
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4 + 4;
  }

  // Signature blocks
  addPageIfNeeded(35);
  y = Math.max(y, doc.internal.pageSize.getHeight() - 55);
  doc.setDrawColor(0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  const sigWidth = (pageWidth - margin * 2 - 16) / 3;
  const sigLabels = [
    "Course Command",
    "Chief Instructor",
    "Commandant",
  ];
  sigLabels.forEach((label, i) => {
    const x = margin + i * (sigWidth + 8);
    doc.line(x, y, x + sigWidth, y);
    doc.setFont("helvetica", "bold");
    doc.text(label, x, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text("Signature & Date", x, y + 9);
  });

  // Watermark + footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    stampWatermark();
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(
      `${record.referenceNumber} · School of Field Artillery · Confidential · Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
    doc.setTextColor(0);
  }

  const safeArmy = record.student.armyNumber.replace(/\s+/g, "-");
  const dateStr = new Date(record.generatedAt).toISOString().slice(0, 10);
  doc.save(`STR-${safeArmy}-${dateStr}.pdf`);
}
