/**
 * Audit bcc6.xlsx vs school DB — 100% accuracy check.
 *
 * Usage: npx tsx scripts/audit-bcc6.ts [path/to/bcc6.xlsx]
 */

import "dotenv/config";
import { config } from "dotenv";
import path from "path";
import * as XLSX from "xlsx";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";
import { tpdfGradeToSystem } from "../lib/utils/bcc-report";

config({ path: ".env.local" });

const WORKBOOK =
  process.argv[2] ||
  path.join(process.env.HOME ?? "", "Desktop/SOFA2/bcc6.xlsx");

const TOL = 0.06; // mark tolerance (Excel floating point)

const COURSE_MAP: Array<{ match: RegExp; code: string }> = [
  { match: /\bFAOAC\b|\bFAOC\b/, code: "FAOC" },
  { match: /\bOBATC\b|\bOBATIC\b/, code: "OBATC" },
  { match: /\bOBGC\b|\bOBG\b/, code: "OBGC" },
  { match: /\bROGC\b|\bROG\b/, code: "ROGC" },
  { match: /\bRSOC\b|\bRSCO\b/, code: "RSOC" },
  { match: /\bBCC\b/, code: "BCC" },
];

function asText(v: unknown): string {
  return String(v ?? "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseFloat(String(v).replace(/[%+,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeArmy(raw: string): string {
  const t = asText(raw).toUpperCase();
  const m = t.match(/^([A-Z]+)\s*(\d+)$/);
  return m ? `${m[1]} ${m[2]}` : t;
}

function resolveCourse(blob: string): string | null {
  const u = blob.toUpperCase();
  for (const e of COURSE_MAP) if (e.match.test(u)) return e.code;
  return null;
}

function parseIntake(title: string): string {
  const t = title.toUpperCase().replace(/\\/g, "/");
  const m =
    t.match(/INT(?:AKE)?(?:\s+YA)?\s*([0-9]+)\s*\/\s*([0-9]{2,4})\s*-\s*([0-9]{2,4})/i) ||
    t.match(/INT(?:AKE)?(?:\s+YA)?\s*([0-9]+)\s*\/\s*([0-9]{2,4})/i);
  if (m) {
    if (m[3]) return `${m[1]}/${m[2].slice(-2)}-${m[3].slice(-2)}`;
    return `${m[1]}/${m[2].slice(-2)}`;
  }
  const m2 = t.match(/INT(?:AKE)?(?:\s+YA)?\s*([0-9]+)/i);
  return m2 ? m2[1] : "unknown";
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const joined = (rows[i] ?? []).map(asText).join(" ").toUpperCase();
    const has =
      joined.includes("DGE") ||
      joined.includes("TOTAL") ||
      joined.includes("BSM") ||
      /\bGT\b/.test(joined) ||
      (joined.includes("AG") && joined.includes("WRM"));
    if (!has) continue;
    if (joined.includes("S/NO") || joined.includes("ARMY NO")) {
      if (joined.includes("AG") || joined.includes("DGE") || joined.includes("GT")) return i;
      continue;
    }
    return i;
  }
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    if ((rows[i] ?? []).map(asText).some((c) => /^TOTAL/i.test(c))) return i;
  }
  return 7;
}

type ExcelStudent = {
  sheet: string;
  courseCode: string;
  intakeNumber: string;
  armyNumber: string;
  fullName: string;
  rank: string;
  unit: string;
  overall: number;
  grade: string;
  subjects: Record<string, number>;
};

function parseSheet(sheetName: string, sheet: XLSX.WorkSheet): ExcelStudent[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  if (!rows.length) return [];
  const title = asText(rows[0]?.[0] ?? rows[0]?.[2] ?? sheetName);
  const courseCode = resolveCourse(`${sheetName} ${title}`);
  if (!courseCode) return [];
  const intakeNumber = parseIntake(title);
  const headerRowIdx = findHeaderRow(rows);
  const header = rows[headerRowIdx] ?? [];

  const subjects: Array<{ name: string; index: number }> = [];
  let totalIdx: number | null = null;
  let gradeIdx: number | null = null;
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
    if (/^POSITION|^POS\b/.test(upper)) continue;
    if (i < 5) continue;
    let name = raw;
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count > 1) name = `${name} (${count})`;
    subjects.push({ name, index: i });
  }

  if (totalIdx == null) {
    for (let c = header.length - 1; c >= 5; c--) {
      const sample = asNumber(rows[headerRowIdx + 1]?.[c]);
      const next = asText(rows[headerRowIdx + 1]?.[c + 1] ?? "");
      if (sample != null && sample > 40 && sample <= 100 && /^[A-E]$/i.test(next)) {
        totalIdx = c;
        gradeIdx = c + 1;
        subjects.splice(
          0,
          subjects.length,
          ...subjects.filter((s) => s.index !== c && s.index !== c + 1)
        );
        break;
      }
    }
  }

  const out: ExcelStudent[] = [];
  const byArmy = new Map<string, ExcelStudent>();

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const army = normalizeArmy(asText(row[1]));
    if (!/^[A-Z]+\s+\d+$/.test(army)) continue;
    const fullName = asText(row[3]);
    if (!fullName || fullName.length < 2) continue;

    const subj: Record<string, number> = {};
    for (const s of subjects) {
      if (totalIdx != null && s.index === totalIdx) continue;
      if (gradeIdx != null && s.index === gradeIdx) continue;
      const marks = asNumber(row[s.index]);
      if (marks == null) continue;
      subj[s.name] = marks;
    }

    let overall = totalIdx != null ? asNumber(row[totalIdx]) : null;
    if (overall == null) overall = Object.values(subj).reduce((a, b) => a + b, 0);
    const grade = (gradeIdx != null ? asText(row[gradeIdx]) : "") || "C";

    byArmy.set(army, {
      sheet: sheetName,
      courseCode,
      intakeNumber,
      armyNumber: army,
      fullName,
      rank: asText(row[2]),
      unit: asText(row[4]),
      overall,
      grade,
      subjects: subj,
    });
  }

  return [...byArmy.values()];
}

type Issue = {
  severity: "error" | "warn";
  sheet: string;
  army?: string;
  message: string;
};

function near(a: number, b: number, tol = TOL): boolean {
  return Math.abs(a - b) <= tol;
}

function normName(s: string): string {
  return s.toUpperCase().replace(/\s+/g, " ").trim();
}

async function main() {
  console.log("Workbook:", WORKBOOK);
  const wb = XLSX.readFile(WORKBOOK, { cellDates: true });

  const excelAll: ExcelStudent[] = [];
  for (const name of wb.SheetNames) {
    const parsed = parseSheet(name, wb.Sheets[name]);
    console.log(`  Excel sheet "${name}": ${parsed.length} students`);
    excelAll.push(...parsed);
  }
  console.log(`Excel total unique rows (per sheet): ${excelAll.length}\n`);

  // Load DB rows for bcc6 imports
  const dbRows = await db.execute(sql`
    select
      e.enrollment_id,
      e.student_army_number as army,
      s.full_name,
      s.rank,
      s.unit,
      e.total_marks::float8 as total_marks,
      e.average_marks::float8 as average_marks,
      e.grade as system_grade,
      e.position,
      c.course_code,
      ci.intake_number,
      r.remarks as sheet_tag,
      (
        select coalesce(json_agg(json_build_object(
          'subject', res.subject_name,
          'marks', res.marks_obtained::float8
        ) order by res.subject_name), '[]'::json)
        from results res where res.enrollment_id = e.enrollment_id
      ) as subjects
    from enrollments e
    join students s on s.army_number = e.student_army_number
    join course_intakes ci on ci.intake_id = e.intake_id
    join courses c on c.course_id = ci.course_id
    join lateral (
      select remarks from results
      where enrollment_id = e.enrollment_id and remarks like 'bcc6:%'
      limit 1
    ) r on true
    where exists (
      select 1 from results rr
      where rr.enrollment_id = e.enrollment_id and rr.remarks like 'bcc6:%'
    )
    order by c.course_code, ci.intake_number, e.student_army_number
  `);

  type DbRow = {
    enrollment_id: number;
    army: string;
    full_name: string;
    rank: string;
    unit: string | null;
    total_marks: number;
    average_marks: number;
    system_grade: string;
    position: number | null;
    course_code: string;
    intake_number: string;
    sheet_tag: string;
    subjects: Array<{ subject: string; marks: number }>;
  };

  const dbList = dbRows.rows as unknown as DbRow[];
  console.log(`DB bcc6 enrollments: ${dbList.length}\n`);

  // Index DB by course+intake+army and by sheet tag + army
  const dbByKey = new Map<string, DbRow>();
  const dbBySheetArmy = new Map<string, DbRow>();
  for (const row of dbList) {
    const army = normalizeArmy(row.army);
    dbByKey.set(`${row.course_code}|${row.intake_number}|${army}`, row);
    const sheet = String(row.sheet_tag ?? "").replace(/^bcc6:/, "");
    dbBySheetArmy.set(`${sheet}|${army}`, row);
  }

  const issues: Issue[] = [];
  let okStudents = 0;
  let okMarks = 0;
  let markChecks = 0;
  let okGrades = 0;
  let gradeChecks = 0;
  let okNames = 0;
  let nameChecks = 0;
  let okCourses = 0;
  let subjectMismatches = 0;
  let subjectChecks = 0;

  const matchedEnrollmentIds = new Set<number>();

  for (const ex of excelAll) {
    const key = `${ex.courseCode}|${ex.intakeNumber}|${ex.armyNumber}`;
    let db =
      dbByKey.get(key) ??
      dbBySheetArmy.get(`${ex.sheet}|${ex.armyNumber}`);

    if (!db) {
      // fuzzy: same course + army (intake label drift)
      db = dbList.find(
        (r) =>
          r.course_code === ex.courseCode &&
          normalizeArmy(r.army) === ex.armyNumber &&
          String(r.sheet_tag).includes(ex.sheet)
      );
    }

    if (!db) {
      issues.push({
        severity: "error",
        sheet: ex.sheet,
        army: ex.armyNumber,
        message: `MISSING in DB — ${ex.courseCode} intake ${ex.intakeNumber} ${ex.rank} ${ex.fullName} total=${ex.overall}`,
      });
      continue;
    }

    matchedEnrollmentIds.add(db.enrollment_id);
    okStudents += 1;

    // Course
    if (db.course_code !== ex.courseCode) {
      issues.push({
        severity: "error",
        sheet: ex.sheet,
        army: ex.armyNumber,
        message: `WRONG COURSE: Excel ${ex.courseCode} vs DB ${db.course_code}`,
      });
    } else {
      okCourses += 1;
    }

    // Name
    nameChecks += 1;
    if (normName(db.full_name) !== normName(ex.fullName)) {
      issues.push({
        severity: "warn",
        sheet: ex.sheet,
        army: ex.armyNumber,
        message: `NAME: Excel "${ex.fullName}" vs DB "${db.full_name}"`,
      });
    } else {
      okNames += 1;
    }

    // Overall marks
    markChecks += 1;
    const dbTotal = Number(db.total_marks);
    if (!near(dbTotal, ex.overall)) {
      issues.push({
        severity: "error",
        sheet: ex.sheet,
        army: ex.armyNumber,
        message: `TOTAL: Excel ${ex.overall} vs DB ${dbTotal}`,
      });
    } else {
      okMarks += 1;
    }

    // Grade (Excel → system)
    gradeChecks += 1;
    const expectedGrade = tpdfGradeToSystem(ex.grade);
    if (String(db.system_grade).toUpperCase() !== expectedGrade) {
      issues.push({
        severity: "error",
        sheet: ex.sheet,
        army: ex.armyNumber,
        message: `GRADE: Excel ${ex.grade}→${expectedGrade} vs DB ${db.system_grade}`,
      });
    } else {
      okGrades += 1;
    }

    // Subject marks
    const dbSubj = new Map(
      (db.subjects ?? []).map((s) => [s.subject, Number(s.marks)])
    );
    for (const [subj, marks] of Object.entries(ex.subjects)) {
      subjectChecks += 1;
      const dbMark = dbSubj.get(subj);
      if (dbMark == null) {
        // try without (2) suffix variants
        const alt = [...dbSubj.entries()].find(
          ([k]) => k.replace(/ \(\d+\)$/, "") === subj.replace(/ \(\d+\)$/, "")
        );
        if (!alt || !near(alt[1], marks)) {
          subjectMismatches += 1;
          if (subjectMismatches <= 40) {
            issues.push({
              severity: "warn",
              sheet: ex.sheet,
              army: ex.armyNumber,
              message: `SUBJECT missing/mismatch: ${subj}=${marks} (DB=${dbMark ?? "—"})`,
            });
          }
        }
      } else if (!near(dbMark, marks)) {
        subjectMismatches += 1;
        if (subjectMismatches <= 40) {
          issues.push({
            severity: "error",
            sheet: ex.sheet,
            army: ex.armyNumber,
            message: `SUBJECT ${subj}: Excel ${marks} vs DB ${dbMark}`,
          });
        }
      }
    }
  }

  // Extra DB enrollments tagged bcc6 not in excel
  for (const row of dbList) {
    if (matchedEnrollmentIds.has(row.enrollment_id)) continue;
    issues.push({
      severity: "warn",
      sheet: String(row.sheet_tag),
      army: row.army,
      message: `EXTRA in DB (not matched to Excel): ${row.course_code} ${row.intake_number} ${row.full_name}`,
    });
  }

  // Count by sheet
  console.log("========== AUDIT SUMMARY ==========");
  console.log(`Excel students:     ${excelAll.length}`);
  console.log(`DB enrollments:     ${dbList.length}`);
  console.log(`Matched students:   ${okStudents}`);
  console.log(`Course OK:          ${okCourses}/${okStudents}`);
  console.log(`Name OK:            ${okNames}/${nameChecks}`);
  console.log(`Total marks OK:     ${okMarks}/${markChecks}`);
  console.log(`Grade OK:           ${okGrades}/${gradeChecks}`);
  console.log(
    `Subject marks OK:   ${subjectChecks - subjectMismatches}/${subjectChecks} (mismatches=${subjectMismatches})`
  );

  const errors = issues.filter((i) => i.severity === "error");
  const warns = issues.filter((i) => i.severity === "warn");
  console.log(`\nErrors: ${errors.length}`);
  console.log(`Warnings: ${warns.length}`);

  if (errors.length) {
    console.log("\n--- ERRORS (first 80) ---");
    for (const i of errors.slice(0, 80)) {
      console.log(`[${i.sheet}] ${i.army ?? ""} ${i.message}`);
    }
  }
  if (warns.length) {
    console.log("\n--- WARNINGS (first 40) ---");
    for (const i of warns.slice(0, 40)) {
      console.log(`[${i.sheet}] ${i.army ?? ""} ${i.message}`);
    }
  }

  const perfect =
    errors.length === 0 &&
    okStudents === excelAll.length &&
    okMarks === markChecks &&
    okGrades === gradeChecks &&
    okCourses === okStudents;

  console.log("\n===================================");
  if (perfect && subjectMismatches === 0 && warns.length === 0) {
    console.log("RESULT: 100% — data matches Excel exactly.");
  } else if (perfect) {
    console.log(
      "RESULT: Core fields 100% (course, totals, grades, student coverage). Subject/name warnings may remain."
    );
  } else {
    console.log("RESULT: NOT 100% — see errors above.");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
