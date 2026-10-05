/**
 * Careful import from Desktop/course report/COURSE REPORT/2020.
 *
 * Usage (from school/):
 *   npx tsx scripts/import-course-report-2020.ts --dry-run
 *   npx tsx scripts/import-course-report-2020.ts --only=BCC-09/20
 *   npx tsx scripts/import-course-report-2020.ts
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
  "Desktop/course report/COURSE REPORT/2020"
);

type ManifestEntry = {
  id: string;
  courseCode: string;
  intakeNumber: string;
  files: string[];
  skip?: string;
};

const MANIFEST: ManifestEntry[] = [
  // —— AFISA ——
  {
    id: "BCC-09/20",
    courseCode: "BCC",
    intakeNumber: "09/20",
    files: [
      "AFISA/BCC/BCC INT 09-20/BCC INTAK 09-20 - CLASS -A.xlsx",
      "AFISA/BCC/BCC INT 09-20/CLASS B.xlsx",
    ],
  },
  {
    id: "BCC-08/18",
    courseCode: "BCC",
    intakeNumber: "08/18",
    files: ["AFISA/BCC/BCC INTAK 08-18.xlsx"],
    skip: "Already imported from course report 2018",
  },
  {
    id: "FAOC-04/19-20",
    courseCode: "FAOC",
    intakeNumber: "04/19-20",
    files: ["AFISA/FAOAC/FAOAC INT 04-19-20.xlsx"],
  },
  {
    id: "OBGC-20/20",
    courseCode: "OBGC",
    intakeNumber: "20/20",
    files: ["AFISA/OBGC/OBGC INT 20-20.xlsx"],
  },
  {
    id: "ROGC-11/19-20",
    courseCode: "ROGC",
    intakeNumber: "11/19-20",
    files: ["AFISA/ROGC/ROGC INT 11-19-20.xlsx"],
    skip: "Password-protected Excel",
  },
  {
    id: "RSOC-05/19-20",
    courseCode: "RSOC",
    intakeNumber: "05/19-20",
    files: ["AFISA/RSOC/RSOC INT 05-19-20.xlsx"],
    skip: "Password-protected (already imported from JIPYA/2019 if unlocked there)",
  },
  {
    id: "RSOC-06/19-20",
    courseCode: "RSOC",
    intakeNumber: "06/19-20",
    files: ["AFISA/RSOC/RSOC INT 06-19-20.xlsx"],
  },

  // —— ASKARI ——
  {
    id: "ARTY-L3-19/20-P",
    courseCode: "ARTY-L3",
    intakeNumber: "19/20-P",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-3 INT 19-20/PAPAA BTY.xlsx"],
  },
  {
    id: "ARTY-L3-19/20-Q",
    courseCode: "ARTY-L3",
    intakeNumber: "19/20-Q",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-3 INT 19-20/QUBEC BTY.xlsx"],
  },
  {
    id: "ARTY-L3-19/20-R",
    courseCode: "ARTY-L3",
    intakeNumber: "19/20-R",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-3 INT 19-20/ROMEO BTY.xlsx"],
  },
  {
    id: "ARTY-L1-19-19-20",
    courseCode: "ARTY-L1",
    intakeNumber: "19-19-20",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-1 INT 19-19-20/PAPAA B.xlsx"],
    skip: "Password-protected Excel",
  },
  {
    id: "ARTY-L2-23-20",
    courseCode: "ARTY-L2",
    intakeNumber: "23-20",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-2 INT 23-20/P - BTY  KUNDI LA 23-19.xlsx"],
    skip: "Password-protected Excel",
  },
  {
    id: "ARTY-TECH-L1-07-20",
    courseCode: "ARTY-TECH-L1",
    intakeNumber: "07-20",
    files: ["ASKARI/ARTY TECH/ARTY TECH L-1/ARTY TECH L-1 INT 07-20.xlsx"],
    skip: "Password-protected Excel",
  },
  {
    id: "ARTY-TECH-L3-08/19-20",
    courseCode: "ARTY-TECH-L3",
    intakeNumber: "08/19-20",
    files: ["ASKARI/ARTY TECH/ARTY TECH L-3/ARTY TECH L-3 INT 08-19-20.xlsx"],
    skip: "Password-protected Excel",
  },
  {
    id: "MGCC-04-20",
    courseCode: "MGCC",
    intakeNumber: "04-20",
    files: ["ASKARI/MGCC/MGCC INT 04-20.xlsx"],
    skip: "Password-protected Excel",
  },
  {
    id: "GT-L2-02-20",
    courseCode: "GT-L2",
    intakeNumber: "02-20",
    files: ["GUN TRACTOR/Gun Tractor L-2 INT 02-20.xlsx"],
    skip: "Password-protected Excel",
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
      if (!last) return 2020;
      if (last.length === 4) return Number(last);
      const yy = Number(last);
      return yy >= 70 ? 1900 + yy : 2000 + yy;
    })(),
    startDate: startDate ?? "2020-01-01",
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
    console.error("No matching manifest entries.");
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
