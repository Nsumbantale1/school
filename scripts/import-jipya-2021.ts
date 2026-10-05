/**
 * Careful one-by-one import from Desktop/JIPYA/2021.
 *
 * Usage (from school/):
 *   npx tsx scripts/import-jipya-2021.ts --dry-run
 *   npx tsx scripts/import-jipya-2021.ts --only=BCC-10/21
 *   npx tsx scripts/import-jipya-2021.ts
 */

import "dotenv/config";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { parseSofaWorkbookAll } from "../lib/utils/sofa-excel";
import { importParsedSofaWorkbook } from "../lib/utils/sofa-import";
import { tpdfGradeToSystem } from "../lib/utils/bcc-report";

config({ path: ".env.local" });

const ROOT = path.join(process.env.HOME ?? "", "Desktop/JIPYA/2021");

type ManifestEntry = {
  id: string;
  courseCode: string;
  intakeNumber: string;
  files: string[];
  skip?: string;
};

const MANIFEST: ManifestEntry[] = [
  // —— MAAFISA ——
  {
    id: "BCC-10/21",
    courseCode: "BCC",
    intakeNumber: "10/21",
    files: ["MAAFISA/BCC INT 10-21/BCC INTAK 10-21.xlsx"],
  },
  {
    id: "OBGC-21/21",
    courseCode: "OBGC",
    intakeNumber: "21/21",
    files: ["MAAFISA/OBGC INT 21-21/OBGC INT 21-21.xlsx"],
  },
  {
    id: "OBGC-22/21",
    courseCode: "OBGC",
    intakeNumber: "22/21",
    files: ["OBGC INT 22-21.xlsx"],
  },
  {
    id: "ROGC-12/21",
    courseCode: "ROGC",
    intakeNumber: "12/21",
    files: ["MAAFISA/ROGC INT 12-21/ROGC INT 12-21.xlsx"],
  },

  // —— ASKARI ——
  {
    id: "AAT-L3-06/20-21",
    courseCode: "AAT-L3",
    intakeNumber: "06/20-21",
    files: ["ASKARI/AATC L-3.xlsx"],
  },
  {
    id: "ARTY-L3-20/21-P",
    courseCode: "ARTY-L3",
    intakeNumber: "20/21-P",
    files: ["ASKARI/ARTYMAN L-3/ARTMAN L-3 INT 20-21/ARTYMAN L-3 INT 20-21 - P Bty.xlsx"],
  },
  {
    id: "ARTY-L3-20/21-Q",
    courseCode: "ARTY-L3",
    intakeNumber: "20/21-Q",
    files: ["ASKARI/ARTYMAN L-3/ARTMAN L-3 INT 20-21/ARTYMAN L-3 INT 20-21 -Q Bty.xlsx"],
  },
  {
    id: "ARTY-L3-21/21-P",
    courseCode: "ARTY-L3",
    intakeNumber: "21/21-P",
    files: ["ASKARI/ARTYMAN L-3/ARTYMAN L-3 INT 21-21/ARTYMAN L-3/ARTYMAN L-3 INT 21-21 P BTY.xlsx"],
  },
  {
    id: "ARTY-L3-21/21-Q",
    courseCode: "ARTY-L3",
    intakeNumber: "21/21-Q",
    files: [
      "ASKARI/ARTYMAN L-3/ARTYMAN L-3 INT 21-21/ARTYMAN L-3/ARTYMAN L-3 INT 21-21 Q BTY.xlsx",
      "ASKARI/ARTYMAN L-3/ARTYMAN L-3 INT 21-21/ARTYMAN L-3/ARTYMAN L-3 INT 21-21 Q BTY -1.xlsx",
    ],
  },
  {
    id: "ARTY-L3-21-21-COMBINED",
    courseCode: "ARTY-L3",
    intakeNumber: "20/21-P",
    files: ["ASKARI/ARTYMAN L-3/ARTYMAN L-3 INT 21-21/ARTYMAN L-3 INT 21-21.xlsx"],
    skip: "Misnamed file — contents are ARTYMAN L-3 20/21 P BTY (same 44 students and marks)",
  },
  {
    id: "ARTY-L2-23/20",
    courseCode: "ARTY-L2",
    intakeNumber: "23/20",
    files: ["ASKARI/ARTYMAN L-2 INT 23-20/P - BTY  KUNDI LA 23-19.xlsx"],
    skip: "Password-protected Excel (P/Q/R/T) — cannot open without password; MATOKEO has no marks",
  },
  {
    id: "ARTY-L2-24/21",
    courseCode: "ARTY-L2",
    intakeNumber: "24/21",
    files: ["ASKARI/ARTYMAN L-2 INT 24-21/P - BTY  KUNDI LA 24-21.xlsx"],
    skip: "Password-protected Excel (P/Q) — cannot open without password",
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
  console.log(`READY n=${students.length} mean=${q.mean?.toFixed(1)} distinct=${q.distinct} grades=`, grades);

  if (dryRun) {
    console.log("DRY-RUN — not written");
    return { id: entry.id, status: "dry_run" as const, n: students.length };
  }

  const parsed = {
    filename: absFiles.map((f) => path.basename(f)).join("+"),
    courseCode: entry.courseCode,
    courseName,
    intakeNumber: entry.intakeNumber,
    year: startDate ? Number(startDate.slice(0, 4)) : 2021,
    startDate: startDate ?? "2021-01-01",
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
