import type { Grade } from "@/lib/db/schema";

export const BCC_COURSE_CODE = "BCC";
export const BCC_META_PREFIX = "BCC1:";

export type BccSection = "theory" | "field";

export type BccResultMeta = {
  section: BccSection;
  theory: number | null;
  practical: number | null;
  total: number;
  weight: number;
  courseGrade: string;
  courseRemarks: string;
};

export type BccResultRow = {
  subjectName: string;
  marksObtained: string | number;
  maxMarks: string | number;
  remarks: string | null;
};

export type BccTheoryLine = {
  subject: string;
  theory: number | null;
  practical: number | null;
  total: number;
  weight: number;
  marks: number;
};

export type BccFieldLine = {
  exercise: string;
  score: number;
  weight: number;
  marks: number;
};

export type BccParsedReport = {
  theory: BccTheoryLine[];
  field: BccFieldLine[];
  theoryMarks: number;
  theoryWeight: number;
  fieldMarks: number;
  fieldWeight: number;
  overall: number;
  tpdfGrade: string;
  tpdfRemarks: string;
  systemGrade: Grade;
};

export function isBccCourse(courseCode: string | null | undefined): boolean {
  return (courseCode ?? "").trim().toUpperCase() === BCC_COURSE_CODE;
}

export function encodeBccRemarks(meta: BccResultMeta): string {
  return BCC_META_PREFIX + JSON.stringify(meta);
}

export function parseBccRemarks(remarks: string | null | undefined): BccResultMeta | null {
  if (!remarks?.startsWith(BCC_META_PREFIX)) return null;
  try {
    const parsed = JSON.parse(remarks.slice(BCC_META_PREFIX.length)) as BccResultMeta;
    if (parsed?.section !== "theory" && parsed?.section !== "field") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function tpdfGradeToSystem(excelGrade: string): Grade {
  const g = excelGrade.trim().toUpperCase();
  if (g === "A" || g === "B" || g === "C" || g === "F") return g;
  if (g === "E") return "D";
  if (g === "D") return "D";
  return "C";
}

export function formatBccGrade(tpdfGrade: string, tpdfRemarks: string): string {
  const letter = tpdfGrade.trim().toUpperCase() || "—";
  const remarks = tpdfRemarks.trim();
  return remarks ? `${letter} · ${remarks}` : letter;
}

export function parseBccResults(rows: BccResultRow[]): BccParsedReport | null {
  const theory: BccTheoryLine[] = [];
  const field: BccFieldLine[] = [];
  let courseGrade = "";
  let courseRemarks = "";

  for (const row of rows) {
    const meta = parseBccRemarks(row.remarks);
    if (!meta) continue;
    if (!courseGrade && meta.courseGrade) courseGrade = meta.courseGrade;
    if (!courseRemarks && meta.courseRemarks) courseRemarks = meta.courseRemarks;

    if (meta.section === "theory") {
      theory.push({
        subject: row.subjectName,
        theory: meta.theory,
        practical: meta.practical,
        total: meta.total,
        weight: meta.weight,
        marks: Number(row.marksObtained),
      });
    } else {
      field.push({
        exercise: row.subjectName,
        score: meta.total,
        weight: meta.weight,
        marks: Number(row.marksObtained),
      });
    }
  }

  if (theory.length === 0 && field.length === 0) return null;

  const theoryMarks = theory.reduce((s, r) => s + r.marks, 0);
  const theoryWeight = theory.reduce((s, r) => s + r.weight, 0);
  const fieldMarks = field.reduce((s, r) => s + r.marks, 0);
  const fieldWeight = field.reduce((s, r) => s + r.weight, 0);
  const overall = theoryMarks + fieldMarks;

  return {
    theory,
    field,
    theoryMarks,
    theoryWeight,
    fieldMarks,
    fieldWeight,
    overall,
    tpdfGrade: courseGrade,
    tpdfRemarks: courseRemarks,
    systemGrade: tpdfGradeToSystem(courseGrade || "C"),
  };
}

export function fmtScore(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}
