/**
 * Careful one-by-one import from Desktop/course report/COURSE REPORT/2018.
 * Explicit course + intake per file — never guess. Skips 2017 duplicates already
 * imported from JIPYA/2017.
 *
 * Usage (from school/):
 *   npx tsx scripts/import-course-report-2018.ts --dry-run
 *   npx tsx scripts/import-course-report-2018.ts --only=BCC-08/18
 *   npx tsx scripts/import-course-report-2018.ts
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
  "Desktop/course report/COURSE REPORT/2018"
);

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
    id: "BCC-08/18",
    courseCode: "BCC",
    intakeNumber: "08/18",
    files: ["KOZI ZA MAAFISA/BCC/BCC INTAK 08-18.xlsx"],
  },
  {
    id: "OBGC-17/17-18",
    courseCode: "OBGC",
    intakeNumber: "17/17-18",
    files: ["KOZI ZA MAAFISA/OBGC/OBGC INT 17-17-18/OBGC INT 19-18-19.xlsx"],
  },
  {
    id: "OBGC-18/17-18",
    courseCode: "OBGC",
    intakeNumber: "18/17-18",
    files: ["KOZI ZA MAAFISA/OBGC/OBGC INT 18-17-18/CLASS - B.xlsx"],
  },
  {
    id: "ROGC-10/17-18",
    courseCode: "ROGC",
    intakeNumber: "10/17-18",
    files: [
      "KOZI ZA MAAFISA/ROGC/ROGC INTAKE 10-17-18/CLASS -  A.xlsx",
      "KOZI ZA MAAFISA/ROGC/ROGC INTAKE 10-17-18/CLASS  - B.xlsx",
    ],
  },

  // —— AAT ——
  {
    id: "AAT-L1-01-16-17",
    courseCode: "AAT-L1",
    intakeNumber: "01-17",
    files: ["KOZI ZA ASKARI/AATC-UFUNDI/AATC L-1 INT 01-16-17/AAT L-1.xlsx"],
    skip: "Same cohort already imported from JIPYA as AAT-L1 01-17",
  },
  {
    id: "AAT-L1-02/17-18",
    courseCode: "AAT-L1",
    intakeNumber: "02/17-18",
    files: ["KOZI ZA ASKARI/AATC-UFUNDI/AATC L-1 INT 02-17-18.xlsx"],
  },
  {
    id: "AAT-L1-03-18",
    courseCode: "AAT-L1",
    intakeNumber: "03-18",
    files: [
      "KOZI ZA ASKARI/AATC-UFUNDI/AATC L-1 INTAK 03-18-18/AATC L-1 INT 03-18.xlsx",
    ],
  },
  {
    id: "AAT-L2-03-18",
    courseCode: "AAT-L2",
    intakeNumber: "03-18",
    files: ["KOZI ZA ASKARI/AATC-UFUNDI/AATC L-2 INT 03-18.xlsx"],
  },

  // —— ARTY TECH L-3 (prefer complete workbook mean ~74) ——
  {
    id: "ARTY-TECH-L3-06/17-18",
    courseCode: "ARTY-TECH-L3",
    intakeNumber: "06/17-18",
    files: [
      "KOZI ZA ASKARI/ARTY TECH/ARTY TECH L-3/ARTY TECH L-3 INT 06-17-18 (2).xlsx",
    ],
  },
  {
    id: "ARTY-TECH-L3-06-bad",
    courseCode: "ARTY-TECH-L3",
    intakeNumber: "06/17-18",
    files: [
      "KOZI ZA ASKARI/ARTY TECH/ARTY TECH L-3/ARTY TECH L-3 INT 06-17-18.xlsx",
    ],
    skip: "Incomplete/low totals (mean ~40); use (2).xlsx instead",
  },
  {
    id: "ARTY-TECH-L3-07/17-18",
    courseCode: "ARTY-TECH-L3",
    intakeNumber: "07/17-18",
    files: [
      "KOZI ZA ASKARI/ARTY TECH/ARTY TECH L-3/ARTY TECH L-3 INT 07-17-18.xlsx",
    ],
  },

  // —— ARTYMAN L-1 (JIPYA copy was empty; these have real marks) ——
  {
    id: "ARTY-L1-17-17-P",
    courseCode: "ARTY-L1",
    intakeNumber: "17-17-P",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-1/ARTYMAN L-1 INT 17-17/PAPAA.xlsx",
    ],
  },
  {
    id: "ARTY-L1-17-17-Q",
    courseCode: "ARTY-L1",
    intakeNumber: "17-17-Q",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-1/ARTYMAN L-1 INT 17-17/QUEBEC.xlsx",
    ],
  },
  {
    id: "ARTY-L1-18-18-P",
    courseCode: "ARTY-L1",
    intakeNumber: "18-18-P",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-1/ARTYMAN L-1 INTAK 18-18/PAPAA B.xlsx",
    ],
  },
  {
    id: "ARTY-L1-18-18-Q",
    courseCode: "ARTY-L1",
    intakeNumber: "18-18-Q",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-1/ARTYMAN L-1 INTAK 18-18/QUEBEC B.xlsx",
    ],
  },
  {
    id: "ARTY-L1-18-18-R",
    courseCode: "ARTY-L1",
    intakeNumber: "18-18-R",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-1/ARTYMAN L-1 INTAK 18-18/ROMEO B.xlsx",
    ],
  },

  // —— ARTYMAN L-2 ——
  {
    id: "ARTY-L2-18-17-P",
    courseCode: "ARTY-L2",
    intakeNumber: "18-17-P",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-2/ARTYMAN L-2 INT 18- 17/PAPAA.xlsx",
    ],
  },
  {
    id: "ARTY-L2-18-17-Q",
    courseCode: "ARTY-L2",
    intakeNumber: "18-17-Q",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-2/ARTYMAN L-2 INT 18- 17/QUEBEC.xlsx",
    ],
  },
  {
    id: "ARTY-L2-19-18-P",
    courseCode: "ARTY-L2",
    intakeNumber: "19-18-P",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-2/ARTYMAN L-2 INT 19-18/P - BTY  KUNDI LA 19-18.xlsx",
    ],
  },
  {
    id: "ARTY-L2-19-18-Q",
    courseCode: "ARTY-L2",
    intakeNumber: "19-18-Q",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-2/ARTYMAN L-2 INT 19-18/Q - BTY  KUNDI LA 19-18.xlsx",
    ],
  },
  {
    id: "ARTY-L2-19-18-R",
    courseCode: "ARTY-L2",
    intakeNumber: "19-18-R",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-2/ARTYMAN L-2 INT 19-18/R - BTY  KUNDI LA 19-18.xlsx",
    ],
  },

  // —— ARTYMAN L-3 ——
  {
    id: "ARTY-L3-17-17-18-P",
    courseCode: "ARTY-L3",
    intakeNumber: "17-17-18-P",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/ARTYMAN L-3 INT 17-17-18/PAPAA BTY.xlsx",
    ],
  },
  {
    id: "ARTY-L3-17-17-18-Q",
    courseCode: "ARTY-L3",
    intakeNumber: "17-17-18-Q",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/ARTYMAN L-3 INT 17-17-18/QUEBEC BTY.xlsx",
    ],
  },
  {
    id: "ARTY-L3-17-17-18-R",
    courseCode: "ARTY-L3",
    intakeNumber: "17-17-18-R",
    files: [
      "KOZI ZA ASKARI/ARTYMAN/ARTYMAN L-3/ARTYMAN L-3 INT 17-17-18/ROMEO BTY.xlsx",
    ],
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
  if (distinct < Math.max(2, Math.floor(students.length * 0.25))) {
    return { ok: false, reason: `too few distinct averages (${distinct})` };
  }
  if (mean < 35 || mean > 98) {
    return { ok: false, reason: `mean overall ${mean.toFixed(1)} outside 35–98` };
  }
  return { ok: true, reason: "ok", mean, distinct, n: students.length };
}

async function importEntry(entry: ManifestEntry, dryRun: boolean) {
  console.log(
    `\n======== ${entry.id} → ${entry.courseCode} / ${entry.intakeNumber} ========`
  );
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

  const byArmy = new Map<string, (typeof allStudents)[0]>();
  for (const s of allStudents) {
    const prev = byArmy.get(s.armyNumber);
    if (!prev || s.overall > prev.overall) byArmy.set(s.armyNumber, s);
  }
  const students = [...byArmy.values()];

  for (const s of students) {
    if (s.overall > 100) {
      console.log(
        `  warn: clamp overall ${s.armyNumber} ${s.overall.toFixed(1)} → 100`
      );
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
      const cleaned = entry.intakeNumber.replace(/-[PQRTpqrt]$/, "");
      const parts = cleaned
        .split(/[-/]/)
        .filter((p) => /^\d{2}$/.test(p) || /^\d{4}$/.test(p));
      const last = parts[parts.length - 1];
      if (!last) return 2018;
      if (last.length === 4) return Number(last);
      const yy = Number(last);
      return yy >= 70 ? 1900 + yy : 2000 + yy;
    })(),
    startDate: startDate ?? "2018-01-01",
    endDate,
    durationWeeks,
    students,
    skippedSheets: 0,
    warnings: [] as string[],
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
