/**
 * Careful one-by-one import from Desktop/JIPYA/2017.
 * Each entry has an explicit course + intake — never guess.
 *
 * Usage (from school/):
 *   npx tsx scripts/import-jipya-2017.ts --dry-run
 *   npx tsx scripts/import-jipya-2017.ts --only=ROGC-09/15
 *   npx tsx scripts/import-jipya-2017.ts
 */

import "dotenv/config";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { parseSofaWorkbookAll } from "../lib/utils/sofa-excel";
import { importParsedSofaWorkbook } from "../lib/utils/sofa-import";
import { tpdfGradeToSystem } from "../lib/utils/bcc-report";

config({ path: ".env.local" });

const ROOT = path.join(
  process.env.HOME ?? "",
  "Desktop/JIPYA/2017"
);

type ManifestEntry = {
  /** Stable id for --only= */
  id: string;
  courseCode: string;
  /** Exact intake number to store (overrides parser). */
  intakeNumber: string;
  files: string[];
  /** Skip reason if we must not import */
  skip?: string;
};

/**
 * Explicit map — folder/file → course + intake.
 * Batteries are separate intakes (-P/-Q/-R/-T) to match SOFA convention.
 */
const MANIFEST: ManifestEntry[] = [
  // —— MAAFISA ——
  {
    id: "OBGC-16/16",
    courseCode: "OBGC",
    intakeNumber: "16/16",
    files: ["KOZI ZA MAAFISA/OBGC INT 1616.xlsx"],
    skip: "Already in DB from bcc6 with correct totals; this workbook has empty/zero weighted marks",
  },
  {
    id: "FAOC-02/17",
    courseCode: "FAOC",
    intakeNumber: "02/17",
    files: ["KOZI ZA MAAFISA/FAOAC INT 02-17.xlsx"],
    skip: "Already in DB from bcc6 — totals match this file exactly",
  },
  {
    id: "ROGC-09/15",
    courseCode: "ROGC",
    intakeNumber: "09/15",
    files: ["KOZI ZA MAAFISA/ROG Int 06-15.xlsx"],
    // Sheet says INT 09/15 (filename 06-15 is wrong)
  },

  // —— ASKARI: AAT ——
  {
    id: "AAT-L1-01-17",
    courseCode: "AAT-L1",
    intakeNumber: "01-17",
    files: ["KOZI ZA ASKARI/AAT/AAT L-1 INT 01-17/AAT L-1.xlsx"],
  },

  // —— ASKARI: ARTY TECH ——
  {
    id: "ARTY-TECH-L2-04-17",
    courseCode: "ARTY-TECH-L2",
    intakeNumber: "04-17",
    files: [
      "KOZI ZA ASKARI/ARTY TECH/ARTY TECH L-2 INT 04-17/ARTY TECH L-2 INT 04.xlsx",
    ],
  },

  // —— ASKARI: GUN TRACTOR ——
  {
    id: "GT-L2-01-17-P",
    courseCode: "GT-L2",
    intakeNumber: "01-17-P",
    files: [
      "KOZI ZA ASKARI/GUN TRACTOR/GUN TRACTOR L-2 INT 01-17/PAPAA BTY.xlsx",
    ],
  },
  {
    id: "GT-L2-01-17-Q",
    courseCode: "GT-L2",
    intakeNumber: "01-17-Q",
    files: [
      "KOZI ZA ASKARI/GUN TRACTOR/GUN TRACTOR L-2 INT 01-17/QUIBECK BTY.xlsx",
    ],
  },
  {
    id: "GT-L3-02-17",
    courseCode: "GT-L3",
    intakeNumber: "02-17",
    files: [
      "KOZI ZA ASKARI/GUN TRACTOR/GUN TRACTOR L-3 INT 02-17/GUN TRACTOR L-3.xlsx",
    ],
  },

  // —— ASKARI: ARTYMAN L-1 (empty marks — skip) ——
  {
    id: "ARTY-L1-17-17",
    courseCode: "ARTY-L1",
    intakeNumber: "17-17",
    files: ["KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-1/ARTYMAN L-1 INT 17-17.xlsx"],
    skip: "Workbook has weights only — all student MARKS are 0 / TOTAL 0",
  },

  // —— ASKARI: ARTYMAN L-2 INT 17-16 ——
  {
    id: "ARTY-L2-17-16-P",
    courseCode: "ARTY-L2",
    intakeNumber: "17-16-P",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-2/ARTYMAN L-2 INT 17-16/PAPAA BTY.xlsx",
    ],
  },
  {
    id: "ARTY-L2-17-16-Q",
    courseCode: "ARTY-L2",
    intakeNumber: "17-16-Q",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-2/ARTYMAN L-2 INT 17-16/QUEBEC BTY.xlsx",
    ],
  },
  {
    id: "ARTY-L2-17-16-R",
    courseCode: "ARTY-L2",
    intakeNumber: "17-16-R",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-2/ARTYMAN L-2 INT 17-16/ROMEO BTY.xlsx",
    ],
  },
  {
    id: "ARTY-L2-18-17",
    courseCode: "ARTY-L2",
    intakeNumber: "18-17",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-2/ARTYMAN L-2 INT 18- 17/PAPAA.xlsx",
    ],
    skip: "Parser finds no usable student report sheets",
  },

  // —— ASKARI: ARTYMAN L-3 INT 15-17 ——
  {
    id: "ARTY-L3-15-17-P",
    courseCode: "ARTY-L3",
    intakeNumber: "15-17-P",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/ARTYMAN L-3 INT 15-17/ARTYMAN L-3 INT 15-17 - PAPAA.xlsx",
    ],
  },
  {
    id: "ARTY-L3-15-17-Q",
    courseCode: "ARTY-L3",
    intakeNumber: "15-17-Q",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/ARTYMAN L-3 INT 15-17/ARTYMAN L-3 INT 15-17 - QUIBECK.xlsx",
    ],
  },
  {
    id: "ARTY-L3-15-17-R",
    courseCode: "ARTY-L3",
    intakeNumber: "15-17-R",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/ARTYMAN L-3 INT 15-17/ARTYMAN L-3 INT 15-17 - ROMEO.xlsx",
    ],
  },

  // —— ASKARI: ARTYMAN L-3 INT 16-17 (folder files misnamed 15-17; sheet says 16-17) ——
  {
    id: "ARTY-L3-16-17-P",
    courseCode: "ARTY-L3",
    intakeNumber: "16-17-P",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/ARTYMAN L-3 INT 16-17/ARTYMAN L-3 INT 15-17 - PAPAA.xlsx",
    ],
  },
  {
    id: "ARTY-L3-16-17-Q",
    courseCode: "ARTY-L3",
    intakeNumber: "16-17-Q",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/ARTYMAN L-3 INT 16-17/ARTYMAN L-3 INT 15-17 - QUIBECK.xlsx",
    ],
  },
  {
    id: "ARTY-L3-16-17-R",
    courseCode: "ARTY-L3",
    intakeNumber: "16-17-R",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/ARTYMAN L-3 INT 16-17/ARTYMAN L-3 INT 15-17 - ROMEO.xlsx",
    ],
  },

  // —— ASKARI: ARTYMAN L-3 INT 14-15-16 ——
  {
    id: "ARTY-L3-14-15-16-P",
    courseCode: "ARTY-L3",
    intakeNumber: "14-15-16-P",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/COURSE REPORT L-3 14-15-16/Artyman L-3 Int 14,15-16 - PAPAA.xlsx",
    ],
  },
  {
    id: "ARTY-L3-14-15-16-Q",
    courseCode: "ARTY-L3",
    intakeNumber: "14-15-16-Q",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/COURSE REPORT L-3 14-15-16/Artyman L-3 Int 14,15-16 - QUEBEC.xlsx",
    ],
  },
  {
    id: "ARTY-L3-14-15-16-R",
    courseCode: "ARTY-L3",
    intakeNumber: "14-15-16-R",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/COURSE REPORT L-3 14-15-16/Artyman L-3 Int 14,15-16 - ROMEO.xlsx",
    ],
  },
  {
    id: "ARTY-L3-14-15-16-T",
    courseCode: "ARTY-L3",
    intakeNumber: "14-15-16-T",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/COURSE REPORT L-3 14-15-16/Artyman_L-3_Int_14,15-16 TANGO.xlsx",
    ],
  },
];

function qualityCheck(students: Array<{ overall: number; tpdfGrade: string }>) {
  if (students.length < 5) return { ok: false, reason: `only ${students.length} students` };
  const avgs = students.map((s) => s.overall);
  const distinct = new Set(avgs.map((a) => +a.toFixed(2))).size;
  const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
  const zeros = avgs.filter((a) => a === 0).length;
  if (zeros > students.length * 0.5) {
    return { ok: false, reason: `${zeros}/${students.length} have zero marks` };
  }
  if (distinct < Math.max(3, Math.floor(students.length * 0.3))) {
    return { ok: false, reason: `too few distinct averages (${distinct})` };
  }
  if (mean < 35 || mean > 98) {
    return { ok: false, reason: `mean overall ${mean.toFixed(1)} outside 35–98` };
  }
  return { ok: true, reason: "ok", mean, distinct, n: students.length };
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

  // Parse each file; merge students (one battery = one file usually)
  const allStudents = [];
  let startDate: string | null = null;
  let endDate: string | null = null;
  let durationWeeks = 16;
  let courseName = entry.courseCode;

  for (const f of absFiles) {
    const groups = parseSofaWorkbookAll(f, path.basename(f));
    if (!groups.length) {
      console.log(`PARSE EMPTY: ${path.basename(f)}`);
      return { id: entry.id, status: "parse_empty" as const };
    }
    const g = groups[0];
    if (g.courseCode !== entry.courseCode) {
      console.log(
        `COURSE MISMATCH: file says ${g.courseCode}, manifest says ${entry.courseCode}`
      );
      return { id: entry.id, status: "course_mismatch" as const };
    }
    courseName = g.courseName;
    startDate = startDate ?? g.startDate;
    endDate = endDate ?? g.endDate;
    durationWeeks = g.durationWeeks;
    allStudents.push(...g.students);
  }

  // Dedupe by army number (keep higher overall)
  const byArmy = new Map<string, (typeof allStudents)[0]>();
  for (const s of allStudents) {
    const prev = byArmy.get(s.armyNumber);
    if (!prev || s.overall > prev.overall) byArmy.set(s.armyNumber, s);
  }
  const students = [...byArmy.values()];

  // Clamp absurd overall > 100 for grade/status only (keep subject rows)
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
    `READY n=${students.length} mean=${q.mean?.toFixed(1)} distinct=${q.distinct} grades=`,
    grades
  );
  console.log(
    `  sample:`,
    students
      .slice()
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 3)
      .map((s) => `${s.armyNumber} ${s.overall.toFixed(1)} ${s.tpdfGrade}`)
      .join(" | ")
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
    year: (() => {
      // Last 2-digit year segment before optional battery suffix (-P/-Q/-R/-T)
      const cleaned = entry.intakeNumber.replace(/-[PQRTpqrt]$/, "");
      const parts = cleaned.split(/[-/]/).filter((p) => /^\d{2}$/.test(p) || /^\d{4}$/.test(p));
      const last = parts[parts.length - 1];
      if (!last) return new Date().getFullYear();
      if (last.length === 4) return Number(last);
      const yy = Number(last);
      return yy >= 70 ? 1900 + yy : 2000 + yy;
    })(),
    startDate: startDate ?? "2017-01-01",
    endDate,
    durationWeeks,
    students,
    skippedSheets: 0,
    warnings: [],
  };

  const summary = await importParsedSofaWorkbook(parsed);
  console.log(
    `IMPORTED intakeId=${summary.intakeId} students=${summary.students} results=${summary.results}`
  );
  if (summary.warnings.length) console.log("  warnings:", summary.warnings);
  return {
    id: entry.id,
    status: "imported" as const,
    intakeId: summary.intakeId,
    n: summary.students,
  };
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

  const entries = only
    ? MANIFEST.filter((e) => e.id === only || e.id.includes(only))
    : MANIFEST;

  if (!entries.length) {
    console.error("No matching manifest entries. Available:");
    for (const e of MANIFEST) console.log(" -", e.id);
    process.exit(1);
  }

  const results = [];
  for (const entry of entries) {
    results.push(await importEntry(entry, dryRun));
  }

  console.log("\n======== SUMMARY ========");
  for (const r of results) console.log(r);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
