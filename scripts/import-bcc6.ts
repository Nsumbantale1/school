/**
 * Import multi-course tabular results from Desktop/SOFA2/bcc6.xlsx
 * (OBGC, FAOC, ROGC, BCC, OBATC, RSOC, …).
 *
 * Usage (from school/):
 *   npx tsx scripts/import-bcc6.ts
 *   npx tsx scripts/import-bcc6.ts /path/to/bcc6.xlsx
 */

import "dotenv/config";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import {
  courses,
  courseIntakes,
  courseSubjects,
  students,
  enrollments,
  results,
} from "../lib/db/schema";
import { tpdfGradeToSystem } from "../lib/utils/bcc-report";
import { DEFAULT_PASSING_MARK } from "../lib/utils/passing-mark";
import { academicStatusFromAverage } from "../lib/utils/enrollment-status";
// NOTE: do NOT call recalculatePositions for bcc6 tabular sheets —
// that recomputes totals from sum(marks)/sum(cohortMax) and overwrites Excel TOTAL/GRADE.

config({ path: ".env.local" });

const DEFAULT_WORKBOOK = path.join(
  process.env.HOME ?? "",
  "Desktop/SOFA2/bcc6.xlsx"
);

const MONTHS: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APRIL: 3,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUNE: 5,
  JUL: 6,
  JULY: 6,
  AUG: 7,
  SEP: 8,
  SEPT: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
  MARCH: 2,
};

const COURSE_MAP: Array<{ match: RegExp; code: string; name: string }> = [
  { match: /\bFAOAC\b|\bFAOC\b/, code: "FAOC", name: "Field Artillery Officers Course" },
  { match: /\bOBATC\b|\bOBATIC\b/, code: "OBATC", name: "Observation Battery Artillery Technician Course" },
  { match: /\bOBGC\b|\bOBG\b/, code: "OBGC", name: "Observation Battery Gunnery Course" },
  { match: /\bROGC\b|\bROG\b/, code: "ROGC", name: "Regimental Officers Gunnery Course" },
  { match: /\bRSOC\b|\bRSCO\b/, code: "RSOC", name: "Regimental Survey Officers Course" },
  { match: /\bBCC\b/, code: "BCC", name: "Battery Commander Course" },
];

function asText(value: unknown): string {
  return String(value ?? "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseFloat(String(value).replace(/[%+,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeArmyNumber(raw: string): string {
  const t = asText(raw).toUpperCase();
  const m = t.match(/^([A-Z]+)\s*(\d+)$/);
  if (m) return `${m[1]} ${m[2]}`;
  return t;
}

function titleRank(raw: string): string {
  const compact = asText(raw);
  if (!compact) return "Lt";
  return compact
    .split(" ")
    .map((part) => {
      if (part.startsWith("(") && part.endsWith(")")) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function resolveCourse(blob: string): { code: string; name: string } | null {
  const upper = blob.toUpperCase();
  for (const entry of COURSE_MAP) {
    if (entry.match.test(upper)) return { code: entry.code, name: entry.name };
  }
  return null;
}

function parseIntakeNumber(title: string): string {
  const t = title.toUpperCase().replace(/\\/g, "/");
  // Prefer SOFA display form: 16/16 or 03/19 or 05/19-20
  const m =
    t.match(/INT(?:AKE)?(?:\s+YA)?\s*([0-9]+)\s*\/\s*([0-9]{2,4})\s*-\s*([0-9]{2,4})/i) ||
    t.match(/INT(?:AKE)?(?:\s+YA)?\s*([0-9]+)\s*\/\s*([0-9]{2,4})/i);
  if (m) {
    const serial = m[1];
    if (m[3]) {
      const a = m[2].slice(-2);
      const b = m[3].slice(-2);
      return `${serial}/${a}-${b}`;
    }
    return `${serial}/${m[2].slice(-2)}`;
  }
  const m2 = t.match(/INT(?:AKE)?(?:\s+YA)?\s*([0-9]+)/i);
  return m2 ? m2[1] : "unknown";
}

function parseYearFromIntake(intakeNumber: string, startDate: string | null): number {
  // 16/16 → 2016; 05/19-20 → 2020 (end year) or 2019
  const slash = intakeNumber.match(/\/(\d{2})(?:-(\d{2}))?$/);
  if (slash) {
    const yy = Number(slash[2] ?? slash[1]);
    return yy >= 70 ? 1900 + yy : 2000 + yy;
  }
  const parts = intakeNumber.split(/[-/]/).map((p) => p.trim());
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (/^\d{4}$/.test(p)) return Number(p);
    if (/^\d{2}$/.test(p)) {
      const yy = Number(p);
      return yy >= 70 ? 1900 + yy : 2000 + yy;
    }
  }
  if (startDate) return Number(startDate.slice(0, 4));
  return new Date().getFullYear();
}

function parseDateToken(day: string, mon: string, year: string): string | null {
  const m = MONTHS[mon.toUpperCase().slice(0, 3)] ?? MONTHS[mon.toUpperCase()];
  if (m == null) return null;
  let y = Number(year);
  if (!Number.isFinite(y)) return null;
  if (y < 100) y = y >= 70 ? 1900 + y : 2000 + y;
  const d = Number(day);
  if (!Number.isFinite(d) || d < 1 || d > 31) return null;
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function extractDates(title: string): { start: string | null; end: string | null } {
  const t = title.toUpperCase().replace(/,/g, " ");
  // FROM 01 FEB 17 TO 29 JUL 17
  let m = t.match(
    /FROM\s+(\d{1,2})\s+([A-Z]{3,9})\s+(\d{2,4})\s+TO\s+(\d{1,2})\s+([A-Z]{3,9})\s+(\d{2,4})/
  );
  if (m) {
    return {
      start: parseDateToken(m[1], m[2], m[3]),
      end: parseDateToken(m[4], m[5], m[6]),
    };
  }
  // KUANZIA 14 MAR 16 HADI 09 SEP 16
  m = t.match(
    /KUANZIA(?:\s+TAREHE)?\s+(\d{1,2})\s+([A-Z]{3,9})\s+(\d{2,4}).{0,40}?HADI(?:\s+TAR(?:EHE)?)?\s+(\d{1,2})\s+([A-Z]{3,9})\s+(\d{2,4})/
  );
  if (m) {
    return {
      start: parseDateToken(m[1], m[2], m[3]),
      end: parseDateToken(m[4], m[5], m[6]),
    };
  }
  // KUANZIA 26AUG19 HADI TAR 23JAN20
  m = t.match(
    /KUANZIA(?:\s+TAREHE)?\s+(\d{1,2})([A-Z]{3,9})(\d{2,4}).{0,40}?HADI(?:\s+TAR(?:EHE)?)?\s+(\d{1,2})([A-Z]{3,9})(\d{2,4})/
  );
  if (m) {
    return {
      start: parseDateToken(m[1], m[2], m[3]),
      end: parseDateToken(m[4], m[5], m[6]),
    };
  }
  // KUANZIA 13JUL20 HADI TAR 21DEC20
  m = t.match(
    /KUANZIA\s+(\d{1,2})([A-Z]{3})(\d{2}).{0,30}?HADI\s+TAR\s+(\d{1,2})([A-Z]{3})(\d{2})/
  );
  if (m) {
    return {
      start: parseDateToken(m[1], m[2], m[3]),
      end: parseDateToken(m[4], m[5], m[6]),
    };
  }
  return { start: null, end: null };
}

function weeksBetween(start: string, end: string | null): number {
  if (!end) return 16;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 16;
  return Math.max(1, Math.round((b - a) / (7 * 24 * 3600 * 1000)));
}

type SubjectCol = { name: string; index: number };

type ParsedStudent = {
  armyNumber: string;
  rank: string;
  fullName: string;
  unit: string;
  overall: number;
  grade: string;
  position: number | null;
  subjects: Array<{ name: string; marks: number; maxMarks: number }>;
};

type ParsedSheet = {
  sheetName: string;
  courseCode: string;
  courseName: string;
  intakeNumber: string;
  year: number;
  startDate: string;
  endDate: string | null;
  durationWeeks: number;
  students: ParsedStudent[];
};

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const joined = (rows[i] ?? []).map(asText).join(" ").toUpperCase();
    const hasSubjects =
      joined.includes("DGE") ||
      joined.includes("TOTAL") ||
      joined.includes("BSM") ||
      /\bGT\b/.test(joined) ||
      (joined.includes("AG") && joined.includes("WRM"));
    if (!hasSubjects) continue;
    // OBATC puts S/NO and subject codes on the same header row
    if (joined.includes("S/NO") || joined.includes("ARMY NO")) {
      if (joined.includes("AG") || joined.includes("DGE") || joined.includes("GT")) return i;
      continue;
    }
    return i;
  }
  // fallback: row with TOTAL
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = (rows[i] ?? []).map(asText);
    if (cells.some((c) => /^TOTAL/i.test(c))) return i;
  }
  return 7;
}

function parseSubjectColumns(header: unknown[]): {
  subjects: SubjectCol[];
  totalIdx: number | null;
  gradeIdx: number | null;
  positionIdx: number | null;
} {
  const subjects: SubjectCol[] = [];
  let totalIdx: number | null = null;
  let gradeIdx: number | null = null;
  let positionIdx: number | null = null;
  const seen = new Map<string, number>();

  for (let i = 0; i < header.length; i++) {
    const raw = asText(header[i]);
    if (!raw) continue;
    const upper = raw.toUpperCase();
    if (upper === "UNIT" && i <= 5) continue;
    if (/^TOTAL/.test(upper)) {
      totalIdx = i;
      continue;
    }
    if (/^GRADE/.test(upper)) {
      gradeIdx = i;
      continue;
    }
    if (/^POSITION|^POS\b/.test(upper)) {
      positionIdx = i;
      continue;
    }
    // skip identity columns
    if (i < 5 && /^(S\/?NO|A\/?NO|ARMY|RANK|FULL|NAME|UNIT)$/i.test(upper)) continue;
    if (i < 5) continue;

    let name = raw.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count > 1) name = `${name} (${count})`;
    subjects.push({ name, index: i });
  }

  return { subjects, totalIdx, gradeIdx, positionIdx };
}

function isDataRow(row: unknown[]): boolean {
  const sno = asText(row[0]);
  const army = asText(row[1]);
  if (!army) return false;
  if (!/^[A-Za-z]/.test(army)) return false;
  // S/NO is usually a number; sometimes missing
  if (sno && !/^\d+$/.test(sno) && !/^[PpMmTt]/.test(sno)) {
    // could be army in col0 for weird sheets — still ok if army-like in col1
  }
  return Boolean(normalizeArmyNumber(army).match(/^[A-Z]+\s+\d+$/));
}

function parseSheet(sheetName: string, sheet: XLSX.WorkSheet): ParsedSheet | null {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  if (!rows.length) return null;

  const title = asText(rows[0]?.[0] ?? rows[0]?.[2] ?? sheetName);
  const course = resolveCourse(`${sheetName} ${title}`);
  if (!course) {
    console.warn(`Skip sheet "${sheetName}": unknown course`);
    return null;
  }

  const headerRowIdx = findHeaderRow(rows);
  const header = rows[headerRowIdx] ?? [];
  let { subjects, totalIdx, gradeIdx, positionIdx } = parseSubjectColumns(header);

  // Some sheets put TOTAL after subjects without labeling on header — detect from data
  if (totalIdx == null) {
    for (let c = header.length - 1; c >= 5; c--) {
      const sample = asNumber(rows[headerRowIdx + 1]?.[c]);
      const next = asText(rows[headerRowIdx + 1]?.[c + 1] ?? "");
      if (sample != null && sample > 40 && sample <= 100 && /^[A-E]$/i.test(next)) {
        totalIdx = c;
        gradeIdx = c + 1;
        // drop any subject that was the total column
        subjects = subjects.filter((s) => s.index !== c && s.index !== c + 1);
        break;
      }
    }
  }

  const { start, end } = extractDates(title);
  const intakeNumber = parseIntakeNumber(title);
  const startDate = start ?? `${parseYearFromIntake(intakeNumber, null)}-01-01`;
  const endDate = end;
  const year = parseYearFromIntake(intakeNumber, startDate);

  // First pass: collect marks to estimate max per subject
  const maxBySubject = new Map<string, number>();
  const parsedStudents: ParsedStudent[] = [];

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (!isDataRow(row)) continue;
    const armyNumber = normalizeArmyNumber(asText(row[1]));
    const fullName = asText(row[3]);
    if (!fullName || fullName.length < 2) continue;

    const subjectMarks: Array<{ name: string; marks: number }> = [];
    for (const sub of subjects) {
      if (totalIdx != null && sub.index === totalIdx) continue;
      if (gradeIdx != null && sub.index === gradeIdx) continue;
      if (positionIdx != null && sub.index === positionIdx) continue;
      const marks = asNumber(row[sub.index]);
      if (marks == null) continue;
      subjectMarks.push({ name: sub.name, marks });
      maxBySubject.set(sub.name, Math.max(maxBySubject.get(sub.name) ?? 0, marks));
    }

    let overall = totalIdx != null ? asNumber(row[totalIdx]) : null;
    if (overall == null) {
      overall = subjectMarks.reduce((s, x) => s + x.marks, 0);
    }
    const gradeRaw = gradeIdx != null ? asText(row[gradeIdx]) : "";
    const position =
      positionIdx != null ? asNumber(row[positionIdx]) : asNumber(row[(totalIdx ?? 0) + 2]);

    parsedStudents.push({
      armyNumber,
      rank: titleRank(asText(row[2])),
      fullName,
      unit: asText(row[4]),
      overall,
      grade: gradeRaw || "C",
      position: position != null && position > 0 && position < 500 ? position : null,
      subjects: subjectMarks.map((s) => ({
        name: s.name,
        marks: s.marks,
        maxMarks: 0, // filled below
      })),
    });
  }

  for (const student of parsedStudents) {
    const deduped = new Map<string, { name: string; marks: number; maxMarks: number }>();
    for (const s of student.subjects) {
      const maxMarks = Math.max(maxBySubject.get(s.name) ?? s.marks, s.marks, 0.01);
      const prev = deduped.get(s.name);
      if (!prev || s.marks > prev.marks) {
        deduped.set(s.name, { name: s.name, marks: s.marks, maxMarks });
      }
    }
    student.subjects = [...deduped.values()];
  }

  if (!parsedStudents.length) {
    console.warn(`Skip sheet "${sheetName}": no students`);
    return null;
  }

  // One row per army number (Excel sometimes repeats)
  const byArmy = new Map<string, ParsedStudent>();
  for (const s of parsedStudents) {
    byArmy.set(s.armyNumber, s);
  }
  const uniqueStudents = [...byArmy.values()];

  return {
    sheetName,
    courseCode: course.code,
    courseName: course.name,
    intakeNumber,
    year,
    startDate,
    endDate,
    durationWeeks: weeksBetween(startDate, endDate),
    students: uniqueStudents,
  };
}

async function upsertCourse(parsed: ParsedSheet): Promise<number> {
  const [existing] = await db
    .select()
    .from(courses)
    .where(eq(courses.courseCode, parsed.courseCode))
    .limit(1);
  if (existing) {
    await db
      .update(courses)
      .set({
        courseName: parsed.courseName,
        durationWeeks: Math.max(existing.durationWeeks, parsed.durationWeeks),
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(courses.courseId, existing.courseId));
    return existing.courseId;
  }
  const [created] = await db
    .insert(courses)
    .values({
      courseCode: parsed.courseCode,
      courseName: parsed.courseName,
      description: `${parsed.courseName}. Imported from bcc6.xlsx historical sheets.`,
      durationWeeks: parsed.durationWeeks,
      passingMark: 55,
      isActive: true,
    })
    .returning({ courseId: courses.courseId });
  return created.courseId;
}

async function upsertSubjects(
  courseId: number,
  parsed: ParsedSheet
): Promise<void> {
  const catalog = new Map<string, number>();
  for (const student of parsed.students) {
    for (const s of student.subjects) {
      catalog.set(s.name, Math.max(catalog.get(s.name) ?? 0, s.maxMarks));
    }
  }
  let sortOrder = 0;
  for (const [subjectName, maxMarks] of catalog) {
    const [existing] = await db
      .select({ subjectId: courseSubjects.subjectId })
      .from(courseSubjects)
      .where(
        and(
          eq(courseSubjects.courseId, courseId),
          eq(courseSubjects.subjectName, subjectName)
        )
      )
      .limit(1);
    if (existing) {
      await db
        .update(courseSubjects)
        .set({ maxMarks: String(maxMarks), sortOrder })
        .where(eq(courseSubjects.subjectId, existing.subjectId));
    } else {
      await db.insert(courseSubjects).values({
        courseId,
        subjectName,
        maxMarks: String(maxMarks),
        sortOrder,
      });
    }
    sortOrder += 1;
  }
}

async function upsertIntake(courseId: number, parsed: ParsedSheet): Promise<number> {
  // Match both new (16/16) and legacy (16-16) intake numbers
  const legacy = parsed.intakeNumber.replace(/\//g, "-");
  const candidates = [...new Set([parsed.intakeNumber, legacy])];

  const existingRows = await db
    .select()
    .from(courseIntakes)
    .where(eq(courseIntakes.courseId, courseId));

  const existing = existingRows.find((r) => candidates.includes(r.intakeNumber));

  if (existing) {
    await db
      .update(courseIntakes)
      .set({
        intakeNumber: parsed.intakeNumber,
        year: parsed.year,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(courseIntakes.intakeId, existing.intakeId));
    return existing.intakeId;
  }
  const [created] = await db
    .insert(courseIntakes)
    .values({
      courseId,
      intakeNumber: parsed.intakeNumber,
      year: parsed.year,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      isActive: true,
    })
    .returning({ intakeId: courseIntakes.intakeId });
  return created.intakeId;
}

async function importSheet(parsed: ParsedSheet): Promise<number> {
  const courseId = await upsertCourse(parsed);
  await upsertSubjects(courseId, parsed);
  const intakeId = await upsertIntake(courseId, parsed);

  const armyNumbers = parsed.students.map((s) => s.armyNumber);
  const existingStudents =
    armyNumbers.length > 0
      ? await db
          .select({ armyNumber: students.armyNumber })
          .from(students)
          .where(inArray(students.armyNumber, armyNumbers))
      : [];
  const studentSet = new Set(existingStudents.map((s) => s.armyNumber));

  const newStudents = parsed.students.filter((s) => !studentSet.has(s.armyNumber));
  // Insert in chunks (Neon limit)
  for (let i = 0; i < newStudents.length; i += 50) {
    await db.insert(students).values(
      newStudents.slice(i, i + 50).map((s) => ({
        armyNumber: s.armyNumber,
        fullName: s.fullName,
        rank: s.rank,
        gender: "male" as const,
        unit: s.unit || null,
        isActive: true,
      }))
    );
  }

  const existingEnrollments = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      armyNumber: enrollments.studentArmyNumber,
    })
    .from(enrollments)
    .where(eq(enrollments.intakeId, intakeId));

  const enrollmentByArmy = new Map(
    existingEnrollments.map((e) => [e.armyNumber, e.enrollmentId])
  );

  const toInsertEnrollments = parsed.students.filter(
    (s) => !enrollmentByArmy.has(s.armyNumber)
  );

  for (let i = 0; i < toInsertEnrollments.length; i += 50) {
    const chunk = toInsertEnrollments.slice(i, i + 50);
    const created = await db
      .insert(enrollments)
      .values(
        chunk.map((s) => {
          const status =
            academicStatusFromAverage(s.overall, DEFAULT_PASSING_MARK) ??
            "completed";
          return {
          studentArmyNumber: s.armyNumber,
          intakeId,
          rankAtEnrollment: s.rank,
          unitAtEnrollment: s.unit || null,
          status,
          ...(status === "incomplete" ? { ceasedAt: new Date() } : {}),
          totalMarks: s.overall.toFixed(2),
          averageMarks: s.overall.toFixed(2),
          grade: tpdfGradeToSystem(s.grade),
          position: s.position,
        };
        })
      )
      .returning({
        enrollmentId: enrollments.enrollmentId,
        armyNumber: enrollments.studentArmyNumber,
      });
    for (const row of created) {
      enrollmentByArmy.set(row.armyNumber, row.enrollmentId);
    }
  }

  // Update existing enrollment marks (parallel small batches)
  const toUpdate = parsed.students.filter((s) =>
    existingEnrollments.some((e) => e.armyNumber === s.armyNumber)
  );
  for (let i = 0; i < toUpdate.length; i += 10) {
    await Promise.all(
      toUpdate.slice(i, i + 10).map(async (s) => {
        const enrollmentId = enrollmentByArmy.get(s.armyNumber);
        if (!enrollmentId) return;
        await db
          .update(enrollments)
          .set({
            rankAtEnrollment: s.rank,
            unitAtEnrollment: s.unit || null,
            status:
              academicStatusFromAverage(s.overall, DEFAULT_PASSING_MARK) ??
              "completed",
            ...(s.overall < DEFAULT_PASSING_MARK
              ? { ceasedAt: new Date() }
              : {}),
            totalMarks: s.overall.toFixed(2),
            averageMarks: s.overall.toFixed(2),
            grade: tpdfGradeToSystem(s.grade),
            position: s.position,
            updatedAt: new Date(),
          })
          .where(eq(enrollments.enrollmentId, enrollmentId));
      })
    );
  }

  const enrollmentIds = [...new Set(enrollmentByArmy.values())];
  for (let i = 0; i < enrollmentIds.length; i += 80) {
    await db
      .delete(results)
      .where(inArray(results.enrollmentId, enrollmentIds.slice(i, i + 80)));
  }

  const resultRows = parsed.students.flatMap((s) => {
    const enrollmentId = enrollmentByArmy.get(s.armyNumber);
    if (!enrollmentId) return [];
    // final safety dedupe per enrollment
    const seen = new Set<string>();
    return s.subjects
      .filter((sub) => {
        if (seen.has(sub.name)) return false;
        seen.add(sub.name);
        return true;
      })
      .map((sub) => ({
        enrollmentId,
        subjectName: sub.name,
        marksObtained: sub.marks.toFixed(2),
        // Weighted contribution already — keep max = mark so % tools don't invent false averages
        maxMarks: sub.marks.toFixed(2),
        grade: null as null,
        remarks: `bcc6:${parsed.sheetName}`,
      }));
  });

  const CHUNK = 60;
  for (let i = 0; i < resultRows.length; i += CHUNK) {
    await db.insert(results).values(resultRows.slice(i, i + CHUNK));
  }

  // Preserve Excel TOTAL + GRADE exactly; rank by overall (do not use recalculatePositions)
  const ranked = [...parsed.students].sort((a, b) => b.overall - a.overall);
  let pos = 1;
  let lastOverall: number | null = null;
  let skip = 0;
  const positionByArmy = new Map<string, number>();
  for (const s of ranked) {
    if (lastOverall !== null && s.overall !== lastOverall) {
      pos += skip;
      skip = 1;
    } else {
      skip += 1;
    }
    positionByArmy.set(s.armyNumber, s.position ?? pos);
    lastOverall = s.overall;
  }

  for (let i = 0; i < parsed.students.length; i += 10) {
    await Promise.all(
      parsed.students.slice(i, i + 10).map(async (s) => {
        const enrollmentId = enrollmentByArmy.get(s.armyNumber);
        if (!enrollmentId) return;
        await db
          .update(enrollments)
          .set({
            totalMarks: s.overall.toFixed(2),
            averageMarks: s.overall.toFixed(2),
            grade: tpdfGradeToSystem(s.grade),
            position: positionByArmy.get(s.armyNumber) ?? s.position,
            status:
              academicStatusFromAverage(s.overall, DEFAULT_PASSING_MARK) ??
              "completed",
            ...(s.overall < DEFAULT_PASSING_MARK
              ? { ceasedAt: new Date() }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(enrollments.enrollmentId, enrollmentId));
      })
    );
  }

  console.log(`   ✓ saved ${parsed.students.length} students, ${resultRows.length} results`);
  return parsed.students.length;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing. Check .env / .env.local");
    process.exit(1);
  }

  const workbookPath = process.argv[2] || DEFAULT_WORKBOOK;
  if (!fs.existsSync(workbookPath)) {
    console.error("Workbook not found:", workbookPath);
    process.exit(1);
  }

  console.log("Workbook:", workbookPath);
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });

  let totalStudents = 0;
  const summaries: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const parsed = parseSheet(sheetName, workbook.Sheets[sheetName]);
    if (!parsed) continue;
    console.log(
      `\n→ ${sheetName}: ${parsed.courseCode} intake ${parsed.intakeNumber} (${parsed.year}) — ${parsed.students.length} students`
    );
    const n = await importSheet(parsed);
    totalStudents += n;
    summaries.push(
      `${parsed.courseCode} INT ${parsed.intakeNumber}: ${n} students`
    );
  }

  console.log("\n======= DONE =======");
  for (const line of summaries) console.log(" ", line);
  console.log(`Total enrollments imported: ${totalStudents}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
