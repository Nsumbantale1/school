/**
 * Careful one-by-one import from Desktop/JIPYA/2019.
 *
 * Usage (from school/):
 *   npx tsx scripts/import-jipya-2019.ts --dry-run
 *   npx tsx scripts/import-jipya-2019.ts --only=FAOC-03/19
 *   npx tsx scripts/import-jipya-2019.ts
 */

import "dotenv/config";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { parseSofaWorkbookAll } from "../lib/utils/sofa-excel";
import { importParsedSofaWorkbook } from "../lib/utils/sofa-import";
import { tpdfGradeToSystem } from "../lib/utils/bcc-report";

config({ path: ".env.local" });

const ROOT = path.join(process.env.HOME ?? "", "Desktop/JIPYA/2019");

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
    id: "FAOC-03/19",
    courseCode: "FAOC",
    intakeNumber: "03/19",
    files: ["AFISA/FAOAC INT 03-19.xlsx"],
  },
  {
    id: "OBATC-02/18-19",
    courseCode: "OBATC",
    intakeNumber: "02/18-19",
    files: ["AFISA/OBATC INT 02-18-19.xlsx"],
  },
  {
    id: "OBGC-19/18-19",
    courseCode: "OBGC",
    intakeNumber: "19/18-19",
    files: [
      "AFISA/OBGC INT 19-18-19/CLASS - A.xlsx",
      "AFISA/OBGC INT 19-18-19/CLASS - B.xlsx",
    ],
  },
  {
    id: "RSOC-05/19-20",
    courseCode: "RSOC",
    intakeNumber: "05/19-20",
    files: ["AFISA/RSOC INT 05-19-20.xlsx"],
    skip: "Draft workbook (many subjects 0.00, grades F/E); complete results already in DB as RSOC 5/19-20",
  },

  // —— ASKARI: AAT / TECH / GT ——
  {
    id: "AAT-L3-05/18-19",
    courseCode: "AAT-L3",
    intakeNumber: "05/18-19",
    files: ["ASKARI/Ufundi (AATC L-3) INTK 05-18-19-UPDATED.xlsx"],
  },
  {
    id: "ARTY-TECH-L2-05A/18-19",
    courseCode: "ARTY-TECH-L2",
    intakeNumber: "05A/18-19",
    files: ["ASKARI/ARTY TECH L-2/ARTY TECH L-2 INTAKE 05-18-19 -A.xlsx"],
  },
  {
    id: "ARTY-TECH-L2-05B/18-19",
    courseCode: "ARTY-TECH-L2",
    intakeNumber: "05B/18-19",
    files: ["ASKARI/ARTY TECH L-2/ARTY TECH L-2 INTAKE 05-18-19 -B.xlsx"],
  },
  {
    id: "GT-L3-03-19",
    courseCode: "GT-L3",
    intakeNumber: "03-19",
    files: ["ASKARI/GUN TRACTOR/GUN TRACTOR L-3 INT 03-19.xlsx"],
    skip: "No student report sheets / MATOKEO roster",
  },

  // —— ARTYMAN L-2 ——
  {
    id: "ARTY-L2-21/19-P",
    courseCode: "ARTY-L2",
    intakeNumber: "21/19-P",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-2 INT 21-19/P - BTY  KUNDI LA 21-19.xlsx"],
  },
  {
    id: "ARTY-L2-21/19-Q",
    courseCode: "ARTY-L2",
    intakeNumber: "21/19-Q",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-2 INT 21-19/Q - BTY  KUNDI LA 21-19.xlsx"],
  },
  {
    id: "ARTY-L2-21/19-R",
    courseCode: "ARTY-L2",
    intakeNumber: "21/19-R",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-2 INT 21-19/R - BTY  KUNDI LA 21-19.xlsx"],
  },
  {
    id: "ARTY-L2-22/19-P",
    courseCode: "ARTY-L2",
    intakeNumber: "22/19-P",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-2 INT 22-19/P - BTY  KUNDI LA 22-19.xlsx"],
  },
  {
    id: "ARTY-L2-22/19-Q",
    courseCode: "ARTY-L2",
    intakeNumber: "22/19-Q",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-2 INT 22-19/Q - BTY  KUNDI LA 22-19.xlsx"],
  },
  {
    id: "ARTY-L2-22/19-R",
    courseCode: "ARTY-L2",
    intakeNumber: "22/19-R",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-2 INT 22-19/R- BTY  KUNDI LA 22-19.xlsx"],
  },

  // —— ARTYMAN L-3 ——
  {
    id: "ARTY-L3-18/19-P",
    courseCode: "ARTY-L3",
    intakeNumber: "18/19-P",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-3 INT 18-19/PAPAA BTY.xlsx"],
  },
  {
    id: "ARTY-L3-18/19-Q",
    courseCode: "ARTY-L3",
    intakeNumber: "18/19-Q",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-3 INT 18-19/QUEBEC BTY.xlsx"],
  },
  {
    id: "ARTY-L3-18/19-R",
    courseCode: "ARTY-L3",
    intakeNumber: "18/19-R",
    files: ["ASKARI/ARTYMAN/ARTYMAN L-3 INT 18-19/ROMEO BTY.xlsx"],
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
      if (!last) return 2019;
      if (last.length === 4) return Number(last);
      const yy = Number(last);
      return yy >= 70 ? 1900 + yy : 2000 + yy;
    })(),
    startDate: startDate ?? "2019-01-01",
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
