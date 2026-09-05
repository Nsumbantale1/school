/**
 * Parser for official SOFA (School of Field Artillery) Excel workbooks.
 * Each student has a report sheet (RIPOTI YA MAFUNZO / FINAL COURSE REPORT).
 */

import * as XLSX from "xlsx";
import { encodeBccRemarks, type BccResultMeta } from "./bcc-report";
import { calculateGrade } from "./grades";
import type { Grade } from "../db/schema";

export type SofaTheoryRow = {
  name: string;
  theory: number | null;
  practical: number | null;
  total: number;
  weight: number;
  marks: number;
};

export type SofaFieldRow = {
  name: string;
  score: number;
  weight: number;
  marks: number;
};

export type SofaStudentReport = {
  armyNumber: string;
  rank: string;
  fullName: string;
  unit: string;
  courseRaw: string;
  intakeRaw: string;
  startDate: string | null;
  endDate: string | null;
  overall: number;
  tpdfGrade: string;
  tpdfRemarks: string;
  theory: SofaTheoryRow[];
  field: SofaFieldRow[];
};

export type ParsedSofaWorkbook = {
  filename: string;
  courseCode: string;
  courseName: string;
  intakeNumber: string;
  year: number;
  startDate: string;
  endDate: string | null;
  durationWeeks: number;
  students: SofaStudentReport[];
  skippedSheets: number;
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

const COURSE_CATALOG: Array<{
  match: RegExp;
  code: string;
  name: string;
}> = [
  {
    match: /\bFAOAC\b|\bFAOC\b/,
    code: "FAOC",
    name: "Field Artillery Officers Course",
  },
  {
    match: /\bROPOC\b/,
    code: "ROPOC",
    name: "Regimental Observation Post Officers Course",
  },
  {
    match: /ARTY\s*SVY\s*L\s*-?\s*3|ARTILLERY\s*SURVEY\s*L\s*-?\s*3|ASVY\s*-?\s*L\s*-?\s*3/,
    code: "ASVY-L3",
    name: "Artillery Survey Level 3",
  },
  {
    match: /ARTY\s*SVY\s*L\s*-?\s*1|ARTILLERY\s*SURVEY\s*L\s*-?\s*1|ASVY\s*-?\s*L\s*-?\s*1/,
    code: "ASVY-L1",
    name: "Artillery Survey Level 1",
  },
  {
    match: /ARTY\s*SVY|ARTILLERY\s*SURVEY|ASVY/,
    code: "ASVY-L2",
    name: "Artillery Survey Level 2",
  },
  {
    match: /ARTY\s*-?\s*TECH\s*-?\s*L\s*-?\s*3/,
    code: "ARTY-TECH-L3",
    name: "Artillery Technician Level 3",
  },
  {
    match: /ARTY\s*-?\s*TECH\s*-?\s*L\s*-?\s*2/,
    code: "ARTY-TECH-L2",
    name: "Artillery Technician Level 2",
  },
  {
    match: /ARTY\s*-?\s*TECH\s*-?\s*L\s*-?\s*1|ARTY\s*-?\s*TECH/,
    code: "ARTY-TECH-L1",
    name: "Artillery Technician Level 1",
  },
  {
    match: /AATC\s*L\s*-?\s*3|AAT\s*-?\s*L\s*-?\s*3/,
    code: "AAT-L3",
    name: "Artillery Armament Technician Level 3",
  },
  {
    match: /AATC\s*L\s*-?\s*2|AAT\s*-?\s*L\s*-?\s*2/,
    code: "AAT-L2",
    name: "Artillery Armament Technician Level 2",
  },
  {
    match: /AAT\s*-?\s*L\s*-?\s*1|AATC\s*L\s*-?\s*1/,
    code: "AAT-L1",
    name: "Artillery Armament Technician Level 1",
  },
  {
    match: /AATC|\bAAT\b/,
    code: "AAT-L2",
    name: "Artillery Armament Technician Level 2",
  },
  {
    match: /ARTYMAN\s*L\s*-?\s*3/,
    code: "ARTY-L3",
    name: "Artilleryman Level 3",
  },
  {
    match: /ARTYMAN\s*L\s*-?\s*2/,
    code: "ARTY-L2",
    name: "Artilleryman Level 2",
  },
  {
    match: /ARTYMAN\s*L\s*-?\s*1/,
    code: "ARTY-L1",
    name: "Artilleryman Level 1",
  },
  {
    match: /\bBCC\b/,
    code: "BCC",
    name: "Battery Commander Course",
  },
  {
    match: /GUN\s*TRACTOR\s*L\s*-?\s*1|GT\s*-?\s*L\s*-?\s*1/,
    code: "GT-L1",
    name: "Gun Tractor Level 1",
  },
  {
    match: /GUN\s*TRACTOR\s*L\s*-?\s*3|GT\s*-?\s*L\s*-?\s*3/,
    code: "GT-L3",
    name: "Gun Tractor Level 3",
  },
  {
    match: /GUN\s*TRACTOR\s*L\s*-?\s*2|GT\s*-?\s*L\s*-?\s*2/,
    code: "GT-L2",
    name: "Gun Tractor Level 2",
  },
  {
    match: /\bMGCC\b/,
    code: "MGCC",
    name: "Master Gunner Cadre Course",
  },
  {
    match: /\bMGC\b/,
    code: "MGC",
    name: "Master Gunner Course",
  },
  {
    match: /\bOBGC\b/,
    code: "OBGC",
    name: "Observation Battery Gunnery Course",
  },
  {
    match: /\bROGC\b|\bROG\b|RO0G|ROOG/,
    code: "ROGC",
    name: "Regimental Officers Gunnery Course",
  },
  {
    match: /\bRSOC\b/,
    code: "RSOC",
    name: "Regimental Survey Officers Course",
  },
];

function asText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
      .toUpperCase();
  }
  return String(value)
    .replace(/[`'’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return null;
  const n = parseFloat(String(value).replace(/[%+,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function cell(row: unknown[] | undefined, index: number): unknown {
  return row?.[index];
}

function titleCaseRank(raw: string): string {
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) return compact;
  return compact
    .split(" ")
    .map((part) => {
      const upper = part.toUpperCase();
      if (
        ["PTE", "CPL", "LCPL", "SGT", "SSGT", "WO", "WOI", "WOII", "WO2", "LT", "CAPT", "MAJ", "COL"].includes(
          upper.replace(/[^A-Z]/g, "")
        )
      ) {
        return upper.replace("WO2", "WOII");
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function normalizeArmyNumber(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 20);
}

function looksLikeArmyNumber(value: string): boolean {
  const v = value.trim();
  if (v.length < 3 || v.length > 20) return false;
  if (/^0+$/.test(v)) return false;
  return /^(MT|P|T|SN)?\s*\d{3,}/i.test(v) || /\d{4,}/.test(v);
}

export function isSkipSheetName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n.startsWith("msururu") ||
    /^sheet\s*\d*$/.test(n) ||
    n.startsWith("final exam") ||
    n.startsWith("practical") ||
    n.startsWith("monthly") ||
    n.startsWith("weekly") ||
    n.startsWith("home ass") ||
    n.startsWith("field ex")
  );
}

function isIdentityHeader(row: unknown[] | undefined): boolean {
  const a = asText(cell(row, 0)).toUpperCase();
  return /FORCE\s*NO|NAMBA(RI)?\s+YA\s+JESHI/.test(a);
}

function isCourseHeader(row: unknown[] | undefined): boolean {
  const a = asText(cell(row, 0)).toUpperCase();
  return a === "KOZI" || a === "COURSE" || a.startsWith("KOZI") || a === "COURSE NAME";
}

function isSubjectHeader(row: unknown[] | undefined): boolean {
  const a = asText(cell(row, 0)).toUpperCase();
  return a === "MASOMO" || a === "SUBJECT" || a === "SUBJECTS";
}

function isFieldHeader(text: string): boolean {
  const t = text.toUpperCase();
  if (t.includes("UFAULU") || t.includes("ASSESSMENT") || t === "DARAJA" || t === "GRADE") {
    return false;
  }
  return (
    t.includes("FIELD EXERCISE") ||
    t.includes("MAZOEZI") ||
    (t.includes("PARTY THREE") && t.includes("FIELD"))
  );
}

function isStopName(name: string): boolean {
  const t = name.toUpperCase();
  if (!t) return true;
  return (
    t.startsWith("TOTAL") ||
    t === "AVERAGE" ||
    t === "SCORE MARKS" ||
    t.startsWith("ALAMA ZA JUMLA") ||
    t.startsWith("ALAMA ZA JUMLA ZA") ||
    t.includes("UFAULU") ||
    t === "DARAJA" ||
    t === "GRADE" ||
    t === "TATHIMINI" ||
    t === "ASSESSMENT" ||
    t === "REMARKS" ||
    t.startsWith("PART ") ||
    t.startsWith("PARTY ") ||
    t.startsWith("SEHEMU") ||
    t.startsWith("PART TWO") ||
    t.startsWith("PART THREE") ||
    t.startsWith("PART FOUR")
  );
}

function isGrandTotalLabel(name: string): boolean {
  const t = name.toUpperCase().replace(/\s+/g, " ").trim();
  return (
    t === "TOTAL AVERAGE" ||
    t === "GRAND TOTAL" ||
    t.includes("ALAMA ZA JUMLA ZA NADHARIA NA VITENDO")
  );
}

function isSubheaderRow(row: unknown[] | undefined): boolean {
  const a = asText(cell(row, 0));
  const f = asText(cell(row, 5)).toUpperCase();
  return !a && (f === "THEORY" || f === "NADHARIA" || f === "SCORE" || f === "ALAMA");
}

function parseSofaDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Excel dates are civil dates in East Africa (UTC+3). Node often
    // stores them as UTC midnight of the previous calendar day.
    const eat = new Date(value.getTime() + 3 * 60 * 60 * 1000);
    return eat.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      const y = parsed.y < 100 ? 2000 + parsed.y : parsed.y;
      return `${y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const text = asText(value).toUpperCase().replace(/,/g, " ").replace(/\s+/g, " ");
  const m = text.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = MONTHS[m[2]];
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    if (month == null || day < 1 || day > 31) return null;
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function looksLikeDateValue(value: unknown): boolean {
  if (value instanceof Date) return true;
  const text = asText(value).toUpperCase();
  return (
    /\d{1,2}\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/.test(text) ||
    /^\d{4}-\d{2}-\d{2}/.test(text)
  );
}

function weeksBetween(start: string, end: string | null): number {
  if (!end) return 16;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 16;
  return Math.max(1, Math.round((b - a) / (7 * 24 * 60 * 60 * 1000)));
}

function catalogFromText(text: string): { code: string; name: string } | null {
  const upper = text.toUpperCase();
  for (const item of COURSE_CATALOG) {
    if (item.match.test(upper)) return { code: item.code, name: item.name };
  }
  return null;
}

function batteryFromFilename(filename: string): string | null {
  const m = filename.toUpperCase().match(/["']?([PQ])["']?\s*BTY/);
  return m ? m[1] : null;
}

function intakeFromFilename(filename: string): string | null {
  const n = filename.toUpperCase();
  const intMatch = n.match(
    /INT(?:AKE)?\s*(\d{1,2}\s*[-/]\s*\d{2,4}(?:\s*[-/]\s*\d{2,4})?)/
  );
  if (intMatch) return intMatch[1].replace(/\s+/g, "").replace(/\//g, "-");
  const kundi = n.match(/KUNDI\s+LA\s+(\d{1,2}(?:\s*[-/]\s*\d{2,4})?)/);
  if (kundi && kundi[1].trim()) return kundi[1].replace(/\s+/g, "").replace(/\//g, "-");
  return null;
}

function withBattery(intake: string, filename: string): string {
  const battery = batteryFromFilename(filename);
  if (!battery) return intake;
  if (new RegExp(`(?:^|[-/\\s])${battery}(?:$|[-/\\s])`, "i").test(intake)) {
    return intake;
  }
  return `${intake}-${battery}`;
}

function intakeFromDates(start: string | null, end: string | null): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const mon = d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
    const yy = String(d.getFullYear()).slice(-2);
    return `${mon}${yy}`;
  };
  if (start && end) return `${fmt(start)}-${fmt(end)}`;
  if (start) return fmt(start);
  return String(new Date().getFullYear());
}

function yearFromDate(iso: string | null, fallback = 2025): number {
  if (!iso) return fallback;
  const y = parseInt(iso.slice(0, 4), 10);
  return Number.isFinite(y) ? y : fallback;
}

export function detectSofaWorkbook(sheetNames: string[]): boolean {
  return sheetNames.some((n) => {
    const t = n.trim().toLowerCase();
    return t.startsWith("msururu") || t.includes("final course") || /\(\d+\)/.test(t);
  });
}

function parseStudentSheet(
  sheetName: string,
  sheet: XLSX.WorkSheet
): SofaStudentReport | null {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  if (rows.length < 8) return null;

  let identityIdx = -1;
  let courseIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    if (identityIdx === -1 && isIdentityHeader(rows[i])) identityIdx = i;
    if (courseIdx === -1 && isCourseHeader(rows[i])) courseIdx = i;
  }
  if (identityIdx === -1) return null;

  let identity = rows[identityIdx + 1] ?? [];
  if (!looksLikeArmyNumber(asText(cell(identity, 0)))) {
    identity = rows[identityIdx + 2] ?? [];
  }
  const armyNumber = normalizeArmyNumber(asText(cell(identity, 0)));
  const rank = titleCaseRank(asText(cell(identity, 3)));
  const fullName = asText(cell(identity, 4));
  const unit = asText(cell(identity, 7));
  if (!looksLikeArmyNumber(armyNumber) || !fullName || fullName === "0") {
    return null;
  }

  let courseRaw = "";
  let intakeRaw = "";
  let startDate: string | null = null;
  let endDate: string | null = null;
  if (courseIdx >= 0) {
    const courseRow = rows[courseIdx + 1] ?? [];
    courseRaw = asText(cell(courseRow, 0));
    const intakeCell = cell(courseRow, 3);
    if (!looksLikeDateValue(intakeCell)) {
      intakeRaw = asText(intakeCell).replace(/\s+/g, "").replace(/\//g, "-");
    }
    startDate = parseSofaDate(cell(courseRow, 4)) ?? parseSofaDate(cell(courseRow, 3));
    endDate = parseSofaDate(cell(courseRow, 7));
  }

  const theory: SofaTheoryRow[] = [];
  const field: SofaFieldRow[] = [];
  let inField = false;
  let tpdfGrade = "";
  let tpdfRemarks = "";
  let overallFromSheet: number | null = null;

  const startScan = Math.max(identityIdx + 2, courseIdx + 2, 0);
  for (let i = startScan; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const name = asText(cell(row, 0));
    const joined = row.map((c) => asText(c)).join(" ").toUpperCase();

    if (isFieldHeader(name) || isFieldHeader(joined)) {
      inField = true;
      continue;
    }

    const gradeLabel = name.toUpperCase();
    if (gradeLabel === "DARAJA" || gradeLabel === "GRADE") {
      tpdfGrade = asText(cell(row, 7)) || asText(cell(row, 5)) || tpdfGrade;
      continue;
    }
    if (
      gradeLabel === "TATHIMINI" ||
      gradeLabel === "ASSESSMENT" ||
      gradeLabel === "REMARKS"
    ) {
      tpdfRemarks = asText(cell(row, 7)) || asText(cell(row, 5)) || tpdfRemarks;
      continue;
    }

    if (isGrandTotalLabel(name)) {
      overallFromSheet =
        asNumber(cell(row, 9)) ??
        asNumber(cell(row, 8)) ??
        asNumber(cell(row, 7)) ??
        overallFromSheet;
      continue;
    }

    if (isSubjectHeader(row) || isSubheaderRow(row) || isStopName(name)) {
      continue;
    }
    if (!name) continue;

    const col5 = asNumber(cell(row, 5));
    const col6 = asNumber(cell(row, 6));
    const col7 = asNumber(cell(row, 7));
    const col8 = asNumber(cell(row, 8));
    const col9 = asNumber(cell(row, 9));

    const theoryLayout = col8 != null && col9 != null && (col7 != null || col5 != null);
    const fieldLayout = !theoryLayout && col5 != null && col6 != null && (col8 != null || col9 != null);

    const treatAsField =
      inField || /field exercise|^mazoezi\b/i.test(name);

    if (treatAsField && (fieldLayout || (col5 != null && col6 != null))) {
      const score = col5 ?? 0;
      const weight = fieldLayout ? col6 ?? 0 : col8 ?? 0;
      const marks = fieldLayout ? (col8 ?? col9 ?? 0) : col9 ?? 0;
      if (weight <= 0 && marks <= 0) continue;
      field.push({
        name,
        score,
        weight: weight || marks,
        marks,
      });
      continue;
    }

    if (theoryLayout) {
      const total = col7 ?? col5 ?? 0;
      const weight = col8 ?? 0;
      const marks = col9 ?? 0;
      if (weight <= 0 && marks <= 0) continue;
      theory.push({
        name,
        theory: col5,
        practical: col6,
        total,
        weight,
        marks,
      });
      continue;
    }

    // 2025 English layout: SUBJECT | SCORE (%) | WEIGHTED SCORE | MARKS
    if (fieldLayout) {
      const score = col5 ?? 0;
      const weight = col6 ?? 0;
      const marks = col8 ?? col9 ?? 0;
      if (weight <= 0 && marks <= 0) continue;
      theory.push({
        name,
        theory: score,
        practical: null,
        total: score,
        weight: weight || marks,
        marks,
      });
    }
  }

  const overall =
    overallFromSheet ??
    theory.reduce((s, r) => s + r.marks, 0) +
      field.reduce((s, r) => s + r.marks, 0);

  if (theory.length === 0 && field.length === 0) return null;

  return {
    armyNumber,
    rank: rank || "Pte",
    fullName,
    unit,
    courseRaw,
    intakeRaw,
    startDate,
    endDate,
    overall,
    tpdfGrade: tpdfGrade || "C",
    tpdfRemarks: tpdfRemarks || "",
    theory,
    field,
  };
}

export function parseSofaWorkbook(
  input: Buffer | Uint8Array | string,
  filename: string
): ParsedSofaWorkbook {
  const workbook =
    typeof input === "string"
      ? XLSX.readFile(input, { cellDates: true })
      : XLSX.read(input, { type: "buffer", cellDates: true });

  const warnings: string[] = [];
  const students: SofaStudentReport[] = [];
  let skippedSheets = 0;

  for (const sheetName of workbook.SheetNames) {
    if (isSkipSheetName(sheetName)) {
      skippedSheets += 1;
      continue;
    }
    const parsed = parseStudentSheet(sheetName, workbook.Sheets[sheetName]);
    if (!parsed) {
      skippedSheets += 1;
      continue;
    }
    students.push(parsed);
  }

  if (students.length === 0) {
    throw new Error(
      `${filename}: no student report sheets found. Use an official SOFA workbook.`
    );
  }

  const fileCatalog = catalogFromText(filename);
  const sheetCatalog =
    catalogFromText(students[0].courseRaw) ??
    catalogFromText(students.map((s) => s.courseRaw).join(" "));
  const catalog = sheetCatalog ?? fileCatalog;
  if (!catalog) {
    throw new Error(`${filename}: could not detect course (KOZI / filename).`);
  }

  const intakeFromStudents = students
    .map((s) => s.intakeRaw)
    .find((v) => v && !looksLikeDateValue(v) && /[0-9]/.test(v));
  const intakeNumber = withBattery(
    intakeFromStudents ||
      intakeFromFilename(filename) ||
      intakeFromDates(students[0].startDate, students[0].endDate),
    filename
  );

  const startDate =
    students.map((s) => s.startDate).find(Boolean) ||
    `${yearFromDate(null)}-01-01`;
  const endDate = students.map((s) => s.endDate).find(Boolean) || null;

  if (students.some((s) => s.theory.length === 0 && s.field.length === 0)) {
    warnings.push("Some student sheets had no subject marks.");
  }

  return {
    filename,
    courseCode: catalog.code,
    courseName: catalog.name,
    intakeNumber,
    year: yearFromDate(endDate || startDate),
    startDate,
    endDate,
    durationWeeks: weeksBetween(startDate, endDate),
    students,
    skippedSheets,
    warnings,
  };
}

export function sofaResultRows(student: SofaStudentReport): Array<{
  subjectName: string;
  marksObtained: string;
  maxMarks: string;
  grade: Grade;
  remarks: string;
}> {
  const used = new Set<string>();
  const uniqueName = (name: string, section: "theory" | "field") => {
    let subjectName = name.slice(0, 150);
    if (section === "field" && used.has(subjectName.toLowerCase())) {
      subjectName = `Field Ex — ${name}`.slice(0, 150);
    }
    let key = subjectName.toLowerCase();
    if (used.has(key)) {
      let n = 2;
      while (used.has(`${key} (${n})`)) n += 1;
      subjectName = `${subjectName} (${n})`.slice(0, 150);
      key = subjectName.toLowerCase();
    }
    used.add(key);
    return subjectName;
  };

  return [
    ...student.theory.map((row) => {
      const meta: BccResultMeta = {
        section: "theory",
        theory: row.theory,
        practical: row.practical,
        total: row.total,
        weight: row.weight,
        courseGrade: student.tpdfGrade,
        courseRemarks: student.tpdfRemarks,
      };
      return {
        subjectName: uniqueName(row.name, "theory"),
        marksObtained: row.marks.toFixed(2),
        maxMarks: row.weight.toFixed(2),
        grade: calculateGrade(row.total, 100),
        remarks: encodeBccRemarks(meta),
      };
    }),
    ...student.field.map((row) => {
      const meta: BccResultMeta = {
        section: "field",
        theory: null,
        practical: null,
        total: row.score,
        weight: row.weight,
        courseGrade: student.tpdfGrade,
        courseRemarks: student.tpdfRemarks,
      };
      return {
        subjectName: uniqueName(row.name, "field"),
        marksObtained: row.marks.toFixed(2),
        maxMarks: row.weight.toFixed(2),
        grade: calculateGrade(row.score, 100),
        remarks: encodeBccRemarks(meta),
      };
    }),
  ];
}
