/**
 * Official course workbook: one row per student, one column per subject.
 * Layout follows the SOFA summary sheet (S/NO, A/NO, RANK, FULL NAME, UNIT,
 * subject marks, TOTAL, POSITION, GRADE).
 */

import * as XLSX from "xlsx";
import { getCourseDisplayMeta } from "./course-catalog";
import { displayName } from "./display-name";
import { writeExcelWorkbook } from "./excel-file";
import { formatDateOnly } from "./format-date";
import { formatCertificateIntake } from "./intake-label";

export type IntakeExcelSubject = {
  subjectName: string;
  sortOrder: number;
};

export type IntakeExcelMark = {
  enrollmentId: number;
  subjectName: string;
  marksObtained: string | number;
};

export type IntakeExcelStudent = {
  enrollmentId: number;
  armyNumber: string;
  rank: string;
  fullName: string;
  unit: string | null;
  averageMarks: string | number | null;
  grade: string | null;
  position: number | null;
};

export type IntakeExcelInput = {
  courseCode: string;
  courseName: string;
  intakeNumber: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  students: IntakeExcelStudent[];
  subjects: IntakeExcelSubject[];
  marks: IntakeExcelMark[];
};

function sofaDate(value: string | Date | null | undefined): string {
  const formatted = formatDateOnly(value, "cert");
  return formatted === "—" ? "" : formatted.toUpperCase();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function subjectKey(name: string): string {
  return name.trim().toLowerCase();
}

/** "Duties at the Gun End (DGE)" → "DGE". */
export function subjectColumnHeader(name: string): string {
  const match = name.match(/\(([^)]+)\)\s*$/);
  const header = (match?.[1] ?? name).trim();
  return header.toUpperCase();
}

function uniqueHeaders(names: string[]): string[] {
  const used = new Map<string, number>();
  return names.map((name) => {
    const base = subjectColumnHeader(name);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base} ${count + 1}`;
  });
}

function sheetName(label: string, intakeLabel: string): string {
  const raw = `${label} ${intakeLabel}`
    .replace(/[\\/?*[\]:]/g, "-")
    .replace(/-+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (raw || "Course").slice(0, 31);
}

export async function buildIntakeWorkbook(input: IntakeExcelInput): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const label = getCourseDisplayMeta(input.courseCode, input.courseName).label;
  const orderedSubjects = [...input.subjects].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.subjectName.localeCompare(b.subjectName);
  });

  const seen = new Set<string>();
  const subjectNames: string[] = [];
  for (const subject of orderedSubjects) {
    const key = subjectKey(subject.subjectName);
    if (seen.has(key)) continue;
    seen.add(key);
    subjectNames.push(subject.subjectName);
  }

  const marksByStudent = new Map<number, Map<string, number>>();
  for (const mark of input.marks) {
    const key = subjectKey(mark.subjectName);
    if (!seen.has(key)) {
      seen.add(key);
      subjectNames.push(mark.subjectName);
    }
    const value = Number(mark.marksObtained);
    if (!Number.isFinite(value)) continue;
    const row = marksByStudent.get(mark.enrollmentId) ?? new Map<string, number>();
    row.set(key, value);
    marksByStudent.set(mark.enrollmentId, row);
  }

  const withMarks = subjectNames.filter((name) => {
    const key = subjectKey(name);
    for (const row of marksByStudent.values()) {
      if (row.has(key)) return true;
    }
    return false;
  });
  const columns = withMarks.length > 0 ? withMarks : subjectNames;
  subjectNames.length = 0;
  subjectNames.push(...columns);

  const headers = uniqueHeaders(subjectNames);
  const identity = ["S/NO", "A/NO", "RANK", "FULL NAME", "UNIT"];
  const tail = ["TOTAL", "POSITION", "GRADE"];
  const width = identity.length + subjectNames.length + tail.length;
  const subjectStart = identity.length;
  const totalCol = subjectStart + subjectNames.length;

  const intakeLabel = formatCertificateIntake({
    intakeNumber: input.intakeNumber,
    startDate: input.startDate,
    endDate: input.endDate,
  });
  const start = sofaDate(input.startDate);
  const end = sofaDate(input.endDate);
  let title = `KOZI YA ${label} ${intakeLabel}`;
  if (start && end) {
    title += ` KUANZIA TAREHE ${start} HADI TAREHE ${end}`;
  } else if (start) {
    title += ` KUANZIA TAREHE ${start}`;
  }

  const headerTop: (string | number | null)[] = Array(width).fill(null);
  headerTop[0] = "S/NO";
  headerTop[1] = "A/NO";
  headerTop[2] = "RANK";
  headerTop[3] = "FULL NAME";
  headerTop[4] = "UNIT";
  if (subjectNames.length > 0) headerTop[subjectStart] = "FINAL EXAMINATIONS";
  headerTop[totalCol] = "TOTAL";
  headerTop[totalCol + 1] = "POSITION";
  headerTop[totalCol + 2] = "GRADE";

  const headerSubjects: (string | number | null)[] = Array(width).fill(null);
  headers.forEach((header, index) => {
    headerSubjects[subjectStart + index] = header;
  });

  const body = input.students.map((student, index) => {
    const marks = marksByStudent.get(student.enrollmentId);
    const subjectValues = subjectNames.map((name) => {
      const value = marks?.get(subjectKey(name));
      return value == null ? null : round2(value);
    });
    const sum = subjectValues.reduce<number>(
      (total, value) => total + (typeof value === "number" ? value : 0),
      0
    );
    const average = Number(student.averageMarks);
    const total = Number.isFinite(average) ? round2(average) : round2(sum);

    return [
      index + 1,
      student.armyNumber,
      student.rank,
      displayName(student.fullName, input.courseCode, input.courseName),
      student.unit ?? "",
      ...subjectValues,
      total,
      student.position ?? null,
      student.grade ?? "",
    ];
  });

  const rows = [[title], headerTop, headerSubjects, ...body];
  const sheet = XLSX.utils.aoa_to_sheet(rows);

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: width - 1 } },
  ];
  for (let column = 0; column < identity.length; column++) {
    merges.push({ s: { r: 1, c: column }, e: { r: 2, c: column } });
  }
  if (subjectNames.length > 1) {
    merges.push({
      s: { r: 1, c: subjectStart },
      e: { r: 1, c: subjectStart + subjectNames.length - 1 },
    });
  }
  for (let column = totalCol; column < width; column++) {
    merges.push({ s: { r: 1, c: column }, e: { r: 2, c: column } });
  }
  sheet["!merges"] = merges;
  sheet["!cols"] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 8 },
    { wch: 24 },
    { wch: 14 },
    ...subjectNames.map(() => ({ wch: 12 })),
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName(label, intakeLabel));
  const bytes = await writeExcelWorkbook(book);
  const buffer = Buffer.from(bytes);
  const filename = `${label} ${intakeLabel}.xlsx`.replace(/[\\/:*?"<>|]+/g, "-");

  return { buffer, filename };
}
