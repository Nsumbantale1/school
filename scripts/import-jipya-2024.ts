/**
 * Careful one-by-one import from Desktop/JIPYA/2024.
 *
 * Usage (from school/):
 *   npx tsx scripts/import-jipya-2024.ts --dry-run
 *   npx tsx scripts/import-jipya-2024.ts --only=GT-L3-05-24
 *   npx tsx scripts/import-jipya-2024.ts
 */

import "dotenv/config";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { parseSofaWorkbookAll } from "../lib/utils/sofa-excel";
import { importParsedSofaWorkbook } from "../lib/utils/sofa-import";
import { tpdfGradeToSystem } from "../lib/utils/bcc-report";

config({ path: ".env.local" });

const ROOT = path.join(process.env.HOME ?? "", "Desktop/JIPYA/2024");

type ManifestEntry = {
  id: string;
  courseCode: string;
  intakeNumber: string;
  files: string[];
  skip?: string;
  /** Overrides for dates mistyped in the workbook (e.g. year 1921). */
  startDate?: string;
  endDate?: string;
  /** Sheet army number is wrong for this full name → correct army number. */
  armyFix?: Record<string, string>;
};

const L1 = "ARTYMAN  L-1";
const L3_26 = "ARTY MAN L- 3 KUNDI LA 26-24";

const MANIFEST: ManifestEntry[] = [
  // —— MAAFISA ——
  {
    id: "OBGC-24-24",
    courseCode: "OBGC",
    intakeNumber: "24-24",
    files: ["OBGC INT 24-24.xlsx"],
  },
  {
    id: "OBGC-25-24-25-TEMPLATE",
    courseCode: "OBGC",
    intakeNumber: "25-24-25",
    files: ["OBGC INT 25-24-25.xlsx"],
    skip: "Empty template (all marks 0; header still says 24/24)",
  },
  {
    id: "ROGC-15A-24",
    courseCode: "ROGC",
    intakeNumber: "15A-24",
    files: ["ROGC INT 15-A.xlsx"],
  },
  {
    id: "ROGC-15B-24",
    courseCode: "ROGC",
    intakeNumber: "15B-24",
    files: ["ROGC INT 15B.xlsx"],
  },
  {
    id: "ROPOC-01-24",
    courseCode: "ROPOC",
    intakeNumber: "01-24",
    files: ["ROPOC.xlsx"],
  },
  {
    id: "BCC-13-24-25",
    courseCode: "BCC",
    intakeNumber: "13-24-25",
    files: ["BCC INT 13-24-25/BCC INT 13-24-25.xlsx"],
    skip: "Pending decision: workbook TOTAL formula SUM(I19:I44) leaves out Final Course Shooting (8.40 for everyone)",
  },
  {
    id: "BCC-13-24-25-TEMPLATE",
    courseCode: "BCC",
    intakeNumber: "13-24-25",
    files: ["BCC INTAK 13-24-25.xlsx"],
    skip: "Empty template (all marks 0)",
  },
  {
    id: "BCC-INTAK-13-COPY",
    courseCode: "BCC",
    intakeNumber: "12-22",
    files: ["BCC INTAK 13.xlsx"],
    skip: "Contents are BCC 12-22 (already imported from 2022)",
  },

  // —— ASKARI ——
  {
    id: "AAT-L3-07-24",
    courseCode: "AAT-L3",
    intakeNumber: "07-24",
    files: ["AATC L-3 INT 07-24.xlsx"],
  },
  {
    id: "AATC-L2-PROGRESS-CHART",
    courseCode: "AAT-L2",
    intakeNumber: "-",
    files: ["AATC L-2.xlsx"],
    skip: "Weekly progress chart, not a final course report",
  },
  {
    id: "ARTY-L1-22-24-P",
    courseCode: "ARTY-L1",
    intakeNumber: "22-24-P",
    files: [`${L1}/ARTYMAN L-1 INT 22-24 - P BTY.xlsx`],
  },
  {
    id: "ARTY-L1-22-24-Q",
    courseCode: "ARTY-L1",
    intakeNumber: "22-24-Q",
    files: [`${L1}/ARTYMAN L-1 INT 22-24 - Q BTY.xlsx`],
  },
  {
    id: "ARTY-L1-23-24-25-TEMPLATE",
    courseCode: "ARTY-L1",
    intakeNumber: "23-24-25-P",
    files: ["ARTYMAN  L-1 - KUNDI LA 23-24-25/ARTYMAN L-1 INT 22-24 - P BTY.xlsx"],
    skip: "Empty template (marks 0) — completed version is in the 2025 folder",
  },
  {
    id: "ARTY-L2-28-24-P",
    courseCode: "ARTY-L2",
    intakeNumber: "28-24-P",
    files: ["ARTYMAN L-2 INT 28-24/KOZI REPORT L-2.xlsx"],
  },
  {
    id: "ARTY-L2-28-24-Q",
    courseCode: "ARTY-L2",
    intakeNumber: "28-24-Q",
    files: ["ARTYMAN L-2 INT 28-24/Copy of KOZI REPORT L-2.xlsx"],
  },
  {
    id: "ARTY-L2-28-24-25-DRAFT",
    courseCode: "ARTY-L2",
    intakeNumber: "28-24-25",
    files: ["ARTYMAN L-2 INT 28-24-25/ARTYMAN L-2 KUNDI LA 28-23-24 P - BTY.xlsx"],
    skip: "Draft (every student 27.91); final P BTY is 'KOZI REPORT L-2.xlsx'",
  },
  {
    id: "ARTY-L3-26-24-P",
    courseCode: "ARTY-L3",
    intakeNumber: "26-24-P",
    files: [`${L3_26}/ARTYMAN L-3 INT 25-23-24 P BTY.xlsx`],
    armyFix: { "KHAJI HASSAN GEKA": "MT 130256" },
  },
  {
    id: "ARTY-L3-26-24-Q",
    courseCode: "ARTY-L3",
    intakeNumber: "26-24-Q",
    files: [`${L3_26}/ARTYMAN L-3 INT 25-23-24 Q BTY.xlsx`],
  },
  {
    id: "ASVY-L2-01-2024",
    courseCode: "ASVY-L2",
    intakeNumber: "01-2024",
    files: ["ARTY SVY L-2 INT 01-24 MG OMAR.xlsx"],
  },
  {
    id: "ASVY-L2-INT-02-DRAFT",
    courseCode: "ASVY-L2",
    intakeNumber: "01-2024",
    files: ["ARTY SVY L-2 INT 02.xlsx"],
    skip: "Draft of the same 11 students (mean 20); final is 'MG OMAR'",
  },
  {
    id: "GT-L3-05-24",
    courseCode: "GT-L3",
    intakeNumber: "05-24",
    files: ["GUN TRACTOR L-3 INT 05-24.xlsx"],
  },
  {
    id: "CONVERSION-122MM-01-24",
    courseCode: "CONVERSION",
    intakeNumber: "01/24",
    files: ["CONVERSION (2).xlsx"],
    skip: "Pending decision: 'Conversion for 122 mm Single Barrel Rocket' is not a catalog course",
  },
];

function qualityCheck(students: Array<{ overall: number; tpdfGrade: string }>) {
  if (students.length < 3) {
    return { ok: false, reason: `only ${students.length} students` };
  }
  const avgs = students.map((s) => s.overall);
  const distinct = new Set(avgs.map((a) => +a.toFixed(2))).size;
  const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
  const zeros = avgs.filter((a) => a === 0).length;
  if (zeros > students.length * 0.5) {
    return { ok: false, reason: `${zeros}/${students.length} have zero marks` };
  }
  if (distinct < Math.max(2, Math.floor(students.length * 0.2))) {
    return { ok: false, reason: `too few distinct averages (${distinct})` };
  }
  if (mean < 30 || mean > 98) {
    return { ok: false, reason: `mean overall ${mean.toFixed(1)} outside 30–98` };
  }
  return { ok: true, reason: "ok", mean, distinct, n: students.length };
}

/** Maps prefix-less army numbers (e.g. "13571") to the single existing student with the same digits. */
async function resolveBareArmyNumbers(students: Array<{ armyNumber: string; fullName: string }>) {
  const bare = students.filter((s) => !/^[A-Za-z]/.test(s.armyNumber));
  if (!bare.length) return;
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  for (const s of bare) {
    const digits = s.armyNumber.replace(/\D/g, "");
    const r: any = await db.execute(
      sql`select army_number, full_name from students where regexp_replace(army_number, '[^0-9]', '', 'g') = ${digits} and army_number <> ${s.armyNumber}`
    );
    const rows = (r.rows ?? r) as Array<{ army_number: string; full_name: string }>;
    if (rows.length === 1) {
      console.log(`  map bare ${s.armyNumber} (${s.fullName}) → ${rows[0].army_number} (${rows[0].full_name})`);
      s.armyNumber = rows[0].army_number;
    } else {
      console.log(`  warn: bare army number ${s.armyNumber} (${s.fullName}) — ${rows.length} candidates, kept as is`);
    }
  }
}

async function importEntry(entry: ManifestEntry, dryRun: boolean) {
  console.log(`\n======== ${entry.id} → ${entry.courseCode} / ${entry.intakeNumber} ========`);
  if (entry.skip) {
    console.log(`SKIP: ${entry.skip}`);
    return { id: entry.id, status: "skipped" as const };
  }

  const absFiles = entry.files.map((f) => path.join(ROOT, f));
  for (const f of absFiles) {
    if (!fs.existsSync(f)) {
      console.log(`MISSING FILE: ${f}`);
      return { id: entry.id, status: "missing" as const };
    }
  }

  const allStudents = [];
  let startDate: string | null = null;
  let endDate: string | null = null;
  let durationWeeks = 16;
  let courseName = entry.courseCode;

  for (const f of absFiles) {
    let groups;
    try {
      groups = parseSofaWorkbookAll(f, path.basename(f));
    } catch (e: any) {
      console.log(`PARSE ERROR: ${e.message?.slice(0, 120)}`);
      return { id: entry.id, status: "parse_error" as const, reason: e.message };
    }
    if (!groups.length) {
      console.log(`PARSE EMPTY: ${path.basename(f)}`);
      return { id: entry.id, status: "parse_empty" as const };
    }
    const g = groups[0];
    const fileCode = g.courseCode === "FAOAC" ? "FAOC" : g.courseCode;
    if (fileCode !== entry.courseCode) {
      console.log(`COURSE MISMATCH: file says ${g.courseCode}, manifest says ${entry.courseCode}`);
      return { id: entry.id, status: "course_mismatch" as const };
    }
    const fileIntake = g.intakeNumber.replace(/-[PQRT]$/, "").replace(/[^0-9]/g, "");
    const wantIntake = entry.intakeNumber.replace(/-[PQRT]$/, "").replace(/[^0-9]/g, "");
    if (fileIntake !== wantIntake) {
      console.log(`INTAKE MISMATCH: file says ${g.intakeNumber}, manifest says ${entry.intakeNumber}`);
      return { id: entry.id, status: "intake_mismatch" as const };
    }
    courseName = g.courseName;
    startDate = startDate ?? g.startDate;
    endDate = endDate ?? g.endDate;
    durationWeeks = g.durationWeeks;
    allStudents.push(...g.students);
  }
  if (entry.startDate) startDate = entry.startDate;
  if (entry.endDate) endDate = entry.endDate;

  for (const s of allStudents) {
    const fix = entry.armyFix?.[s.fullName.trim().toUpperCase()];
    if (fix && fix !== s.armyNumber) {
      console.log(`  fix army number: ${s.fullName} ${s.armyNumber} → ${fix}`);
      s.armyNumber = fix;
    }
  }

  const withMarks = allStudents.filter((s) => {
    const empty = s.overall === 0 && [...s.theory, ...s.field].every((r) => !r.marks);
    if (empty) console.log(`  skip (no marks at all): ${s.armyNumber} ${s.fullName}`);
    return !empty;
  });
  allStudents.length = 0;
  allStudents.push(...withMarks);

  await resolveBareArmyNumbers(allStudents);

  const byArmy = new Map<string, (typeof allStudents)[0]>();
  for (const s of allStudents) {
    const prev = byArmy.get(s.armyNumber);
    if (prev && prev.fullName.trim().toUpperCase() !== s.fullName.trim().toUpperCase()) {
      console.log(
        `  WARNING: ${s.armyNumber} used for two names: "${prev.fullName}" (${prev.overall.toFixed(2)}) and "${s.fullName}" (${s.overall.toFixed(2)})`
      );
    }
    if (!prev || s.overall > prev.overall) byArmy.set(s.armyNumber, s);
  }
  const students = [...byArmy.values()];

  for (const s of students) {
    if (s.overall > 100) {
      console.log(`  warn: clamp overall ${s.armyNumber} ${s.overall.toFixed(1)} → 100`);
      s.overall = 100;
    }
  }

  const q = qualityCheck(students);
  if (!q.ok) {
    console.log(`QUALITY FAIL: ${q.reason}`);
    return { id: entry.id, status: "quality_fail" as const, reason: q.reason };
  }

  const grades: Record<string, number> = {};
  for (const s of students) {
    const g = tpdfGradeToSystem(s.tpdfGrade);
    grades[g] = (grades[g] || 0) + 1;
  }
  console.log(
    `READY n=${students.length} mean=${q.mean?.toFixed(1)} distinct=${q.distinct} dates=${startDate}..${endDate} grades=`,
    grades
  );

  if (dryRun) {
    console.log("DRY-RUN — not written");
    return { id: entry.id, status: "dry_run" as const, n: students.length };
  }

  const parsed = {
    filename: absFiles.map((f) => path.basename(f)).join("+"),
    courseCode: entry.courseCode,
    courseName,
    intakeNumber: entry.intakeNumber,
    year: startDate ? Number(startDate.slice(0, 4)) : 2024,
    startDate: startDate ?? "2024-01-01",
    endDate,
    durationWeeks,
    students,
    skippedSheets: 0,
    warnings: [] as string[],
  };

  const summary = await importParsedSofaWorkbook(parsed);
  console.log(`IMPORTED intakeId=${summary.intakeId} students=${summary.students} results=${summary.results}`);
  if (summary.warnings.length) console.log("  warnings:", summary.warnings);
  return { id: entry.id, status: "imported" as const, intakeId: summary.intakeId, n: summary.students };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const only = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);

  if (!fs.existsSync(ROOT)) {
    console.error("Folder not found:", ROOT);
    process.exit(1);
  }

  console.log(dryRun ? "DRY RUN" : "LIVE IMPORT");
  console.log("Root:", ROOT);
  if (only) console.log("Only:", only);

  const entries = only ? MANIFEST.filter((e) => e.id === only) : MANIFEST;
  if (!entries.length) {
    console.error("No matching manifest entries. Available:");
    for (const e of MANIFEST) console.log(" -", e.id);
    process.exit(1);
  }

  const results = [];
  for (const entry of entries) results.push(await importEntry(entry, dryRun));

  console.log("\n======== SUMMARY ========");
  for (const r of results) console.log(r);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
