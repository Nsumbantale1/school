/**
 * Repair bcc6-imported enrollments: restore Excel TOTAL / GRADE / status / position
 * and fix subject max_marks (weighted marks already sum to ~TOTAL).
 *
 * Usage (from school/):
 *   npx tsx scripts/repair-bcc6-totals.ts
 *   npx tsx scripts/repair-bcc6-totals.ts /path/to/bcc6.xlsx
 *   npx tsx scripts/repair-bcc6-totals.ts --dry-run
 */

import "dotenv/config";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { enrollments, results } from "../lib/db/schema";
import { tpdfGradeToSystem } from "../lib/utils/bcc-report";
import { DEFAULT_PASSING_MARK } from "../lib/utils/passing-mark";
import { academicStatusFromAverage } from "../lib/utils/enrollment-status";

config({ path: ".env.local" });

const DEFAULT_WORKBOOK = path.join(
  process.env.HOME ?? "",
  "Desktop/SOFA2/bcc6.xlsx"
);

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APRIL: 3, APR: 3, MAY: 4, JUN: 5, JUNE: 5,
  JUL: 6, JULY: 6, AUG: 7, SEP: 8, SEPT: 8, OCT: 9, NOV: 10, DEC: 11, MARCH: 2,
};

const COURSE_MAP: Array<{ match: RegExp; code: string; name: string }> = [
  { match: /\bFAOAC\b|\bFAOC\b/, code: "FAOC", name: "Field Artillery Officers Course" },
  { match: /\bOBATC\b|\bOBATIC\b/, code: "OBATC", name: "Observation Battery Artillery Technician Course" },
  { match: /\bOBGC\b|\bOBG\b/, code: "OBGC", name: "Officers Basic Gunnery Course" },
  { match: /\bROGC\b|\bROG\b/, code: "ROGC", name: "Regimental Officers Gunnery Course" },
  { match: /\bRSOC\b|\bRSCO\b/, code: "RSOC", name: "Regimental Survey Officers Course" },
  { match: /\bBCC\b/, code: "BCC", name: "Battery Commander Course" },
];

function asText(value: unknown): string {
  return String(value ?? "").replace(/`/g, "").replace(/\s+/g, " ").trim();
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

function resolveCourse(blob: string): { code: string; name: string } | null {
  const upper = blob.toUpperCase();
  for (const entry of COURSE_MAP) {
    if (entry.match.test(upper)) return { code: entry.code, name: entry.name };
  }
  return null;
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] ?? [];
    const texts = row.map((c) => asText(c).toUpperCase());
    if (
      texts.some((t) => t === "DGE" || t === "TOTAL" || t === "GRADE") &&
      texts.filter((t) => t.length >= 2 && t.length <= 12).length >= 5
    ) {
      return i;
    }
  }
  return 0;
}

function parseSubjectColumns(header: unknown[]): {
  subjects: Array<{ name: string; index: number }>;
  totalIdx: number | null;
  gradeIdx: number | null;
  positionIdx: number | null;
} {
  const subjects: Array<{ name: string; index: number }> = [];
  let totalIdx: number | null = null;
  let gradeIdx: number | null = null;
  let positionIdx: number | null = null;

  for (let i = 0; i < header.length; i++) {
    const h = asText(header[i]).toUpperCase();
    if (!h) continue;
    if (h === "TOTAL" || h === "OVERALL" || h === "AVG" || h === "AVERAGE") {
      totalIdx = i;
      continue;
    }
    if (h === "GRADE" || h === "GRD") {
      gradeIdx = i;
      continue;
    }
    if (h === "POS" || h === "POSITION" || h === "S/NO" || h === "SNO") {
      if (h === "POS" || h === "POSITION") positionIdx = i;
      continue;
    }
    if (
      ["S/NO", "A/NO", "ARMY", "RANK", "FULL NAME", "NAME", "UNIT", "NO"].includes(h)
    ) {
      continue;
    }
    if (i >= 5) subjects.push({ name: h, index: i });
  }
  return { subjects, totalIdx, gradeIdx, positionIdx };
}

function isDataRow(row: unknown[]): boolean {
  const army = asText(row[1]);
  if (!army) return false;
  if (!/^[A-Za-z]/.test(army)) return false;
  return Boolean(normalizeArmyNumber(army).match(/^[A-Z]+\s+\d+$/));
}

type ExcelStudent = {
  armyNumber: string;
  overall: number;
  grade: string;
  position: number | null;
  subjects: Array<{ name: string; marks: number }>;
};

function parseSheet(sheetName: string, sheet: XLSX.WorkSheet): {
  sheetName: string;
  courseCode: string;
  students: ExcelStudent[];
} | null {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  if (!rows.length) return null;

  const title = asText(rows[0]?.[0] ?? rows[0]?.[2] ?? sheetName);
  const course = resolveCourse(`${sheetName} ${title}`);
  if (!course) return null;

  const headerRowIdx = findHeaderRow(rows);
  const header = rows[headerRowIdx] ?? [];
  let { subjects, totalIdx, gradeIdx, positionIdx } = parseSubjectColumns(header);

  if (totalIdx == null) {
    for (let c = header.length - 1; c >= 5; c--) {
      const sample = asNumber(rows[headerRowIdx + 1]?.[c]);
      const next = asText(rows[headerRowIdx + 1]?.[c + 1] ?? "");
      if (sample != null && sample > 40 && sample <= 100 && /^[A-E]$/i.test(next)) {
        totalIdx = c;
        gradeIdx = c + 1;
        subjects = subjects.filter((s) => s.index !== c && s.index !== c + 1);
        break;
      }
    }
  }

  const byArmy = new Map<string, ExcelStudent>();

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
    }

    let overall = totalIdx != null ? asNumber(row[totalIdx]) : null;
    if (overall == null || overall < 0 || overall > 100) {
      overall = subjectMarks.reduce((s, x) => s + x.marks, 0);
    }
    if (overall > 100) {
      overall = Math.min(100, subjectMarks.reduce((s, x) => s + x.marks, 0));
    }
    const gradeRaw = gradeIdx != null ? asText(row[gradeIdx]) : "";
    const sno = asNumber(row[0]);

    byArmy.set(armyNumber, {
      armyNumber,
      overall,
      grade: gradeRaw || "C",
      position: sno != null && sno > 0 && sno < 500 ? sno : null,
      subjects: subjectMarks,
    });
  }

  if (!byArmy.size) return null;
  return {
    sheetName,
    courseCode: course.code,
    students: [...byArmy.values()],
  };
}

async function repairSheet(
  parsed: { sheetName: string; courseCode: string; students: ExcelStudent[] },
  dryRun: boolean
) {
  const tag = `bcc6:${parsed.sheetName}`;
  const tagged = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      army: enrollments.studentArmyNumber,
      avg: enrollments.averageMarks,
      grade: enrollments.grade,
      status: enrollments.status,
      intakeId: enrollments.intakeId,
    })
    .from(enrollments)
    .innerJoin(results, eq(results.enrollmentId, enrollments.enrollmentId))
    .where(like(results.remarks, `${tag}%`))
    .groupBy(
      enrollments.enrollmentId,
      enrollments.studentArmyNumber,
      enrollments.averageMarks,
      enrollments.grade,
      enrollments.status,
      enrollments.intakeId
    );

  // Fallback: match by exact remarks
  let rows = tagged;
  if (rows.length === 0) {
    const alt = await db.execute(sql`
      select distinct e.enrollment_id as "enrollmentId",
             e.student_army_number as army,
             e.average_marks as avg,
             e.grade,
             e.status,
             e.intake_id as "intakeId"
      from enrollments e
      join results r on r.enrollment_id = e.enrollment_id
      where r.remarks = ${tag}
    `);
    rows = (alt.rows as Array<{
      enrollmentId: number;
      army: string;
      avg: string | null;
      grade: string | null;
      status: string;
      intakeId: number;
    }>).map((r) => ({
      enrollmentId: Number(r.enrollmentId),
      army: String(r.army),
      avg: r.avg,
      grade: r.grade as typeof enrollments.$inferSelect.grade,
      status: r.status as typeof enrollments.$inferSelect.status,
      intakeId: Number(r.intakeId),
    }));
  }

  const byArmy = new Map(rows.map((r) => [r.army, r]));
  let fixed = 0;
  let matched = 0;
  let missingInDb = 0;
  let alreadyOk = 0;
  let falseFailsFixed = 0;

  const excelByOverall = [...parsed.students].sort((a, b) => b.overall - a.overall);
  let pos = 1;
  let lastOverall: number | null = null;
  let skip = 0;
  const positionByArmy = new Map<string, number>();
  for (const s of excelByOverall) {
    if (lastOverall !== null && s.overall !== lastOverall) {
      pos += skip;
      skip = 1;
    } else {
      skip += 1;
    }
    positionByArmy.set(s.armyNumber, s.position ?? pos);
    lastOverall = s.overall;
  }

  for (const s of parsed.students) {
    const e = byArmy.get(s.armyNumber);
    if (!e) {
      missingInDb++;
      continue;
    }
    matched++;
    const sysGrade = tpdfGradeToSystem(s.grade);
    const status =
      academicStatusFromAverage(s.overall, DEFAULT_PASSING_MARK) ?? "completed";
    const position = positionByArmy.get(s.armyNumber) ?? s.position;
    const dbAvg = e.avg != null ? parseFloat(String(e.avg)) : NaN;
    const avgDiff = !Number.isFinite(dbAvg) || Math.abs(dbAvg - s.overall) > 0.15;
    const gradeDiff = e.grade !== sysGrade;
    const statusDiff = e.status !== status;
    const needsFix = avgDiff || gradeDiff || statusDiff;

    if (!needsFix) {
      alreadyOk++;
    } else {
      if (e.grade === "F" && sysGrade !== "F") falseFailsFixed++;
      fixed++;
      if (!dryRun) {
        await db
          .update(enrollments)
          .set({
            totalMarks: s.overall.toFixed(2),
            averageMarks: s.overall.toFixed(2),
            grade: sysGrade,
            status,
            position,
            ceasedAt: status === "incomplete" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(enrollments.enrollmentId, e.enrollmentId));
      }
    }

    // Always repair max_marks = marks for bcc6 weighted subjects (safe for recalculate)
    if (!dryRun) {
      await db.execute(sql`
        update results
        set max_marks = marks_obtained,
            updated_at = now()
        where enrollment_id = ${e.enrollmentId}
          and remarks like ${tag + "%"}
          and max_marks is distinct from marks_obtained
      `);
    }
  }

  const unmatchedDb = [...byArmy.keys()].filter(
    (a) => !parsed.students.some((s) => s.armyNumber === a)
  );

  return {
    sheetName: parsed.sheetName,
    courseCode: parsed.courseCode,
    excelStudents: parsed.students.length,
    dbTagged: rows.length,
    matched,
    missingInDb,
    unmatchedDb: unmatchedDb.length,
    alreadyOk,
    fixed,
    falseFailsFixed,
  };
}

async function auditNonBcc6Suspicious() {
  // Intakes not from bcc6 with high fail rate and avg near pass mark (possible similar bug)
  const res = await db.execute(sql`
    select ci.intake_id,
           ci.intake_number,
           c.course_code,
           count(e.enrollment_id)::int as students,
           count(*) filter (where e.grade = 'F')::int as failed,
           count(*) filter (where e.status = 'incomplete')::int as incomplete,
           round(avg(e.average_marks::numeric), 1) as avg_avg,
           bool_or(r.remarks like 'bcc6:%') as from_bcc6
    from course_intakes ci
    join courses c on c.course_id = ci.course_id
    join enrollments e on e.intake_id = ci.intake_id
    left join lateral (
      select remarks from results where enrollment_id = e.enrollment_id limit 1
    ) r on true
    group by ci.intake_id, ci.intake_number, c.course_code
    having count(*) filter (where e.grade = 'F')::float / nullif(count(e.enrollment_id), 0) > 0.25
       and count(e.enrollment_id) >= 10
    order by failed desc
  `);
  return res.rows;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const workbookPath =
    args.find((a) => !a.startsWith("--")) ?? DEFAULT_WORKBOOK;

  if (!fs.existsSync(workbookPath)) {
    console.error("Workbook not found:", workbookPath);
    process.exit(1);
  }

  console.log(dryRun ? "DRY RUN — no writes" : "REPAIR MODE — writing fixes");
  console.log("Workbook:", workbookPath);

  const wb = XLSX.readFile(workbookPath, { cellDates: true });
  const summaries = [];

  for (const sheetName of wb.SheetNames) {
    const parsed = parseSheet(sheetName, wb.Sheets[sheetName]);
    if (!parsed) {
      console.log(`skip ${sheetName}: not a course results sheet`);
      continue;
    }
    const summary = await repairSheet(parsed, dryRun);
    summaries.push(summary);
    console.log(
      `${summary.sheetName} (${summary.courseCode}): excel=${summary.excelStudents} db=${summary.dbTagged} matched=${summary.matched} fixed=${summary.fixed} falseFailsFixed=${summary.falseFailsFixed} ok=${summary.alreadyOk} missingInDb=${summary.missingInDb} unmatchedDb=${summary.unmatchedDb}`
    );
  }

  const totalFixed = summaries.reduce((s, x) => s + x.fixed, 0);
  const totalFalse = summaries.reduce((s, x) => s + x.falseFailsFixed, 0);
  console.log("\nTOTAL fixed enrollments:", totalFixed);
  console.log("TOTAL false fails corrected:", totalFalse);

  console.log("\n--- Post-check: intakes with >25% grade F ---");
  const suspicious = await auditNonBcc6Suspicious();
  for (const row of suspicious) {
    console.log(row);
  }
  if (!suspicious.length) console.log("(none)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
