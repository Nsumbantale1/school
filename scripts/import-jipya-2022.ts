/**
 * Careful one-by-one import from Desktop/JIPYA/2022.
 *
 * Usage (from school/):
 *   npx tsx scripts/import-jipya-2022.ts --dry-run
 *   npx tsx scripts/import-jipya-2022.ts --only=BCC-12-22
 *   npx tsx scripts/import-jipya-2022.ts
 */

import "dotenv/config";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { parseSofaWorkbookAll } from "../lib/utils/sofa-excel";
import { importParsedSofaWorkbook } from "../lib/utils/sofa-import";
import { tpdfGradeToSystem } from "../lib/utils/bcc-report";

config({ path: ".env.local" });

const ROOT = path.join(process.env.HOME ?? "", "Desktop/JIPYA/2022");

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

const L2_27 = "ASKARI/ARTYMAN L-2 INT 27-22 c";

const MANIFEST: ManifestEntry[] = [
  // —— MAAFISA ——
  {
    id: "BCC-12-22",
    courseCode: "BCC",
    intakeNumber: "12-22",
    files: ["MAAFISA/BCC/BCC INTAK 12-22.xlsx"],
    armyFix: { "ARON MATHEW LIPAWAGA": "P 11772" },
  },
  {
    id: "BCC-11/21-22",
    courseCode: "BCC",
    intakeNumber: "11/21-22",
    files: [
      "MAAFISA/BCC/INT 11-22/BCC INTAK 11-21-22 CLASS A.xlsx",
      "MAAFISA/BCC/INT 11-22/BCC INTAK 11-21-22 CLASS B.xlsx",
    ],
  },
  {
    id: "OBGC-23/22-23",
    courseCode: "OBGC",
    intakeNumber: "23/22-23",
    files: ["MAAFISA/OBGC/OBGC INT 23-22-23.xlsx"],
  },
  {
    id: "ROGC-13/22",
    courseCode: "ROGC",
    intakeNumber: "13/22",
    files: ["MAAFISA/ROGC INT 13-22/ROGC INT 13-22 (1).xlsx"],
    skip: "Detailed report is password-protected; RESULTS.xlsx and Book1.xlsx are summaries that contradict each other",
  },

  // —— ASKARI ——
  {
    id: "AAT-L1-05/21-22",
    courseCode: "AAT-L1",
    intakeNumber: "05/21-22",
    files: ["ASKARI/AATC L-1 INT 05-21-22/AATC L-1 INT 05-21-22.xlsx"],
    startDate: "2021-10-24",
  },
  {
    id: "AAT-L2-04/22",
    courseCode: "AAT-L2",
    intakeNumber: "04/22",
    files: ["ASKARI/AATC L-2/AATC L-2 INT 04-22.xlsx"],
    endDate: "2022-09-09",
  },
  {
    id: "ARTY-TECH-L2-06-22",
    courseCode: "ARTY-TECH-L2",
    intakeNumber: "06-22",
    files: ["ASKARI/ARTY TECH L-2 INT 06-22/ARTY TECH L-2 INTAKE 06-22.xlsx"],
    startDate: "2022-05-29",
  },
  {
    id: "ARTY-L2-27/22-P",
    courseCode: "ARTY-L2",
    intakeNumber: "27/22-P",
    files: [`${L2_27}/'P'' - BTY  KUNDI LA 27-22.xlsx`],
  },
  {
    id: "ARTY-L2-27/22-Q",
    courseCode: "ARTY-L2",
    intakeNumber: "27/22-Q",
    files: [`${L2_27}/'Q'' - BTY  KUNDI LA 27-22.xlsx`],
  },
  {
    id: "ARTY-L2-27/22-R",
    courseCode: "ARTY-L2",
    intakeNumber: "27/22-R",
    files: [`${L2_27}/''R'' - BTY  KUNDI LA 27-22.xlsx`],
  },
  {
    id: "ARTY-L2-27/22-DRAFT",
    courseCode: "ARTY-L2",
    intakeNumber: "27/22-P",
    files: ["ASKARI/ARTYMAN L-2 INT 27-22/'P'' - BTY  KUNDI LA 27-22.xlsx"],
    skip: "Draft folder (P mean 39, Q/R unreadable); complete version is in 'ARTYMAN L-2 INT 27-22 c'",
  },
  {
    id: "ARTY-L3-23/22-P",
    courseCode: "ARTY-L3",
    intakeNumber: "23/22-P",
    files: ["ASKARI/ARTYMAN L-3 INT 23-22/ARTYMAN L-3 INT 23-22 - P BTY.xlsx"],
  },
  {
    id: "ARTY-L3-23/22-Q",
    courseCode: "ARTY-L3",
    intakeNumber: "23/22-Q",
    files: ["ASKARI/ARTYMAN L-3 INT 23-22/ARTYMAN L-3 INT 23-22 - Q BTY.xlsx"],
  },
  {
    id: "ASVY-L3-04/21-22",
    courseCode: "ASVY-L3",
    intakeNumber: "04/21-22",
    files: ["ASKARI/SVY L-3/ARTY SVY L-3 INT 04-21-22.xlsx"],
  },
  {
    id: "ASVY-L3-05/22",
    courseCode: "ASVY-L3",
    intakeNumber: "05/22",
    files: ["ASKARI/SVY L-3/ARTY SVY L-3 INT 05-22.xlsx"],
  },
  {
    id: "ARTY-L1-21/22",
    courseCode: "ARTY-L1",
    intakeNumber: "21/22",
    files: ["ASKARI/ARTYMAN  L-1/ARTYMAN L-1 INT 21-22 - P BTY.xlsx"],
    skip: "Password-protected Excel (P/Q); only a summary roster (Book1.xlsx) is readable",
  },
  {
    id: "ARTY-L2-26/22",
    courseCode: "ARTY-L2",
    intakeNumber: "26/22",
    files: ["ASKARI/ARTYMAN L-2 INT 26-22/'P'' - BTY  KUNDI LA 26-22.xlsx"],
    skip: "Password-protected Excel (P/Q); only a summary roster (MATOKEO.xlsx) is readable",
  },
  {
    id: "GT-L2-03/22",
    courseCode: "GT-L2",
    intakeNumber: "03/22",
    files: ["ASKARI/GUNTRACTOR L-2/Gun Tractor L-2 INT 03-22.xlsx"],
    skip: "Password-protected Excel; only a summary roster (MATOKEO.xlsx) is readable",
  },
  {
    id: "ARTY-TECH-L3-09/22",
    courseCode: "ARTY-TECH-L3",
    intakeNumber: "09/22",
    files: ["ASKARI/ARTYTECH L-3 INT 09-22/ARTY TECH L-3 INT 09-22.xlsx"],
    skip: "Password-protected Excel — cannot open without password",
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
    year: startDate ? Number(startDate.slice(0, 4)) : 2022,
    startDate: startDate ?? "2022-01-01",
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
