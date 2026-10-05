/**
 * Import transcribed summary tables from JIPYA/MADOGO DATABASE (one intake per manifest entry).
 *
 *   npx tsx scripts/import-madogo.ts --only=GT-L2:02/20 --dry-run
 *   npx tsx scripts/import-madogo.ts --only=GT-L2:02/20
 *
 * Subject names / weights come from the course's existing template in the DB. Entries with
 * `subjects: null` have no known template, so only the overall and grade are stored.
 * Existing students keep their DB name, rank and unit (the tables carry short / misspelt names).
 */
import "dotenv/config";
import { config } from "dotenv";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
config({ path: ".env.local" });

const ROOT = "/home/nstumbantale/Desktop/JIPYA/MADOGO DATABASE";

type Entry = {
  file: string;
  sheet: string;
  courseCode: string;
  courseName: string;
  durationWeeks: number;
  intakeNumber: string;
  year: number;
  startDate: string;
  endDate: string;
  /** Column label → [subject name, weight]. */
  subjects: Record<string, [string, number]> | null;
  /** Column index → label, for sheets that repeat a header (e.g. two "FD" columns). */
  relabel?: Record<number, string>;
  /** Raw number → corrected; key "RAW|FULL NAME" when one raw number is shared by two rows. */
  armyFix?: Record<string, string>;
  /** Numbers confirmed by the user to be imported exactly as written. */
  acceptArmy?: string[];
  /** Corrected army number → column label → mark, for transcription slips (mark above weight). */
  markFix?: Record<string, Record<string, number>>;
  /** "ARMY:LABEL" marks above weight that agree with the row's TOTAL, kept as written. */
  acceptOverWeight?: string[];
  /** Existing records whose name / rank / unit are replaced by this table's values. */
  overwriteStudent?: string[];
  exclude?: string[];
};

const ARTY_TECH_L3: Record<string, [string, number]> = {
  GM: ["Gunnery Mathematics", 8],
  DOP: ["Duties at the Observation Post", 20],
  DGE: ["Duties at the Gun End", 4],
  AI: ["Artillery Instruments", 12],
  AFCS: ["Artillery Fire Control System", 15],
  MU: ["Map Using", 5],
  SVY: ["Survey", 12],
  FD: ["Fire Discipline", 4],
  BLST: ["Ballistics", 3],
  AFOP: ["Artillery Fire Orders Procedure", 3],
  AMMO: ["Ammunition", 2],
  CIV: ["Civics", 2],
  IS: ["Internal Security", 2],
  MI: ["Millitary Intelligency", 2],
  HA: ["Home Assignment", 2],
  WT: ["Weekly Test", 2],
  MT: ["Monthly Test", 2],
};

const MANIFEST: Entry[] = [
  {
    file: "ARTY TECH/ARTY_TECH_L3_INTAKE_0819-20.xlsx",
    sheet: "TABLE DATA",
    courseCode: "ARTY-TECH-L3",
    courseName: "Artillery Technician Level 3",
    durationWeeks: 20,
    intakeNumber: "08/19-20",
    year: 2020,
    startDate: "2019-09-30",
    endDate: "2020-02-13",
    subjects: ARTY_TECH_L3,
    armyFix: { "MT 125000": "MT 125009" },
  },
  {
    file: "ARTY TECH/ARTYTECH_L3_INTAKE_09_22 badoo.xlsx",
    sheet: "Table",
    courseCode: "ARTY-TECH-L3",
    courseName: "Artillery Technician Level 3",
    durationWeeks: 20,
    intakeNumber: "09/22",
    year: 2022,
    startDate: "2022-01-24",
    endDate: "2022-06-09",
    subjects: Object.fromEntries(
      Object.entries(ARTY_TECH_L3).map(([k, v]) => [k === "BLST" ? "BLSC" : k, v])
    ),
    acceptOverWeight: ["MT 130489:AFOP"],
  },
  {
    file: "GUN TRUCTOR/GUN_TRACTOR_L-3_INTAKE 03-19.xlsx",
    sheet: "Gum Tractor 1-3 Intake",
    courseCode: "GT-L3",
    courseName: "Gun Tractor Level 3",
    durationWeeks: 13,
    intakeNumber: "03/19",
    year: 2019,
    startDate: "2019-03-11",
    endDate: "2019-06-03",
    subjects: {
      "CG&CI": ["Cabin General and Control Instrument", 8],
      "S&T": ["System and troubleshooting", 9],
      MC: ["Military Convoy", 10],
      GD: ["Gun Drills", 15],
      DD: ["Deployment Drills", 15],
      GTDE: ["Gun Tractors Driving Exercises", 30],
      "I&SX": ["Iveco/SX", 10],
      WT: ["Weekly Test", 2],
      HA: ["Home Assignment", 1],
      MT: ["Monthly Test", 1],
    },
    acceptArmy: ["MT 988022"],
  },
  {
    file: "GUN TRUCTOR/KOZ1_YA_GUN_TRACTOR_L2_INTAKE_02-20.xlsx",
    sheet: "TABLE DATA",
    courseCode: "GT-L2",
    courseName: "Gun Tractor Level 2",
    durationWeeks: 10,
    intakeNumber: "02/20",
    year: 2020,
    startDate: "2020-07-13",
    endDate: "2020-09-09",
    subjects: {
      GTE: ["Gun Tractors Driving Exerises", 30],
      DD: ["Deployment Drills", 15],
      GD: ["Gun Drills", 15],
      "GT-SX": ["Gun Tractor SX 2190", 10],
      MCVY: ["Military Convoy", 10],
      "CG/CI": ["Cabin General and Control Instrument", 8],
      MI: ["Millitary Intelligency", 4],
      EQPT: ["Equipment", 3],
      MU: ["Map Using", 2],
      WT: ["Weekly Test", 2],
      MT: ["Monthly Test", 1],
    },
    armyFix: { "MT 12193": "MT 121993" },
  },
  {
    file: "GUN TRUCTOR/Kozi_ya_Gun_Tractor_L2_Intake_03_22.xlsx",
    sheet: "L-2 Intake 03-22",
    courseCode: "GT-L2",
    courseName: "Gun Tractor Level 2",
    durationWeeks: 10,
    intakeNumber: "03/22",
    year: 2022,
    startDate: "2022-05-30",
    endDate: "2022-07-26",
    subjects: {
      GTE: ["Gun Tractors Driving Exercise (GTE)", 30],
      DD: ["Deployment Drills (DD)", 15],
      GD: ["Gun Drill (GD)", 15],
      "GT-SX": ["Gun Tractor SX2190 (GT-SX)", 10],
      MI: ["Millitary Intelligence (MI)", 3],
      "CG&CI": ["Cabin General and Control Instrument (CG&CI)", 8],
      MCVY: ["Millitary Convoy (MCVY)", 10],
      EQPT: ["Equipment (EQPT)", 3],
      MU: ["Map Using (MU)", 2],
      WT: ["Weekly Test (WT)", 2],
      MT: ["Monthly Test (MT)", 1],
      HA: ["Home Assignment (HA)", 1],
    },
    acceptArmy: ["MT 13183"],
  },
  {
    file: "ARTY TECH/ARTY TECH L-2 22.xlsx",
    sheet: "ARTY TECH L-2 22",
    courseCode: "ARTY-TECH-L1",
    courseName: "Artillery Technician Level 1",
    durationWeeks: 16,
    intakeNumber: "07/20",
    year: 2020,
    startDate: "2020-03-20",
    endDate: "2020-08-07",
    subjects: null,
  },
  {
    file: "ARTY MAN 3 INTK 23-22 bado.xlsx",
    sheet: "INT 24 ",
    courseCode: "ARTY-L3",
    courseName: "Artilleryman Level 3",
    durationWeeks: 26,
    intakeNumber: "24/22-23",
    year: 2023,
    startDate: "2022-09-09",
    endDate: "2023-03-09",
    relabel: { 21: "FD ENGR" },
    subjects: {
      DGE: ["Duties at the Gun End (DGE)", 15],
      EQPT: ["Equipment (EQPT)", 7],
      AMMO: ["Ammunition (AMMO)", 4],
      GD: ["Gun Drill (GD)", 18],
      AI: ["Artillery Instruments (AI)", 5],
      MI: ["Military Intelligence (MI)", 3],
      MU: ["Map Using (MU)", 3],
      FD: ["Fire Discipline (FD)", 5],
      CIV: ["Civics (CIV)", 2],
      TAC: ["Tactics (TAC)", 3],
      FC: ["Field Craft (FC)", 2],
      PT: ["Physical Training (PT)", 4],
      FTD: ["Foot Drill (FTD)", 3],
      "WPN TRG": ["Weapon Training (Wpn Trg)", 3],
      ML: ["Military Law (ML)", 2],
      JC: ["Judo and Carate (J&C)", 3],
      OBC: ["Outward Bound Course (OBC)", 4],
      TK: ["Tracking (TK)", 3],
      "FD ENGR": ["Field Engineering (Fd Engr)", 2],
      EP: ["Equipment Programme (EP)", 5],
      MT: ["Monthly Test (MT)", 2],
      WT: ["Weekly Test (WT)", 1],
      HA: ["Home Assignment (HA)", 1],
    },
    armyFix: {
      "MT 1218548": "MT 128548",
      "MT 118967|ALLY MAINOLFU KUPUYA": "MT 118969",
      "MT 134614|PETER OMARY NYANZOBE": "MT 128468",
      "MT 134625|LEONARD BENEDICT NKWERA": "MT 134614",
      "MT 128468|LIVING NICODEM KIMARIO": "MT 134625",
      "MT 129257": "MT 129157",
    },
    markFix: {
      "MT 124335": { "WPN TRG": 2.82, ML: 1.48 },
      "MT 131351": { CIV: 1.26 },
    },
    overwriteStudent: ["MT 116703"],
  },
  {
    file: "ARTY TECH/ARTY TECH L-1 23.xlsx",
    sheet: "ARTT TECH L-1 23",
    courseCode: "ARTY-TECH-L1",
    courseName: "Artillery Technician Level 1",
    durationWeeks: 16,
    intakeNumber: "08/22-23",
    year: 2023,
    startDate: "2022-12-27",
    endDate: "2023-05-19",
    subjects: null,
  },
];

const REMARKS: Record<string, string> = {
  A: "Excellent",
  B: "Very Good",
  C: "Good",
  D: "Satisfactory",
  E: "Satisfactory",
  F: "Failure",
};

const digits = (s: string) => s.replace(/\D/g, "");
const tokens = (s: string) =>
  s.toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter((t) => t.length >= 3);
const cellNum = (v: unknown) => {
  const s = String(v ?? "").trim().replace(/\.{2,}/g, ".");
  return s === "" ? NaN : Number(s);
};

function readTable(e: Entry) {
  const wb = XLSX.read(fs.readFileSync(path.join(ROOT, e.file)), { sheetRows: 1000 });
  const ws = wb.Sheets[e.sheet];
  if (!ws) throw new Error(`sheet "${e.sheet}" not found in ${e.file}`);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
  const hi = rows.findIndex((r) => r.some((c) => /^TOTAL$/i.test(String(c).trim())));
  if (hi < 0) throw new Error("no TOTAL header");
  const width = Math.max(rows[hi].length, rows[hi - 1]?.length ?? 0);
  const label = Array.from({ length: width }, (_, i) =>
    (e.relabel?.[i] ?? (String(rows[hi][i] ?? "").trim() || String(rows[hi - 1]?.[i] ?? "").trim())).toUpperCase()
  );
  const col = (re: RegExp) => label.findIndex((c) => re.test(c));
  const cols = {
    army: col(/^(ARMY NO|A\/NO|FORCE NO\.?)$/),
    rank: col(/^RANK$/),
    name: col(/^FULL NAME$/),
    first: col(/^FIRST NAME$/),
    middle: col(/^MIDDLE NAME$/),
    last: col(/^LAST NAME$/),
    unit: col(/^UNIT$/),
    total: col(/^TOTAL$/),
    grade: col(/^GRADE$/),
  };
  if (cols.army < 0 || cols.rank < 0 || cols.total < 0 || cols.grade < 0 || (cols.name < 0 && cols.first < 0)) {
    throw new Error(`header columns missing: ${JSON.stringify(cols)} labels=${label.join(",")}`);
  }
  const subjectCols = new Map<string, number>();
  if (e.subjects) {
    for (const key of Object.keys(e.subjects)) {
      const idx = label.map((c, i) => (c === key.toUpperCase() ? i : -1)).filter((i) => i >= 0);
      if (idx.length !== 1) throw new Error(`subject column "${key}" found ${idx.length} times`);
      subjectCols.set(key, idx[0]);
    }
    const extra = label.slice((cols.unit >= 0 ? cols.unit : cols.name) + 1, cols.total)
      .filter((c) => c && !Object.keys(e.subjects!).some((k) => k.toUpperCase() === c));
    if (extra.length) throw new Error(`unmapped subject columns: ${extra.join(",")}`);
  }
  const data = rows.slice(hi + 1).filter((r) => /\d{4,}/.test(String(r[cols.army])));
  return { cols, subjectCols, data, labels: label };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const verify = process.argv.includes("--verify");
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  const entries = MANIFEST.filter((e) => !only || `${e.courseCode}:${e.intakeNumber}` === only);
  if (!entries.length) throw new Error(`no manifest entry for ${only}`);

  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { importParsedSofaWorkbook, normalizeArmyNumber } = await import("../lib/utils/sofa-import");

  for (const e of entries) {
    console.log(`\n===== ${e.courseCode} ${e.intakeNumber}  (${e.file} [${e.sheet}])`);
    const { cols, subjectCols, data } = readTable(e);
    const problems: string[] = [];
    const warnings: string[] = [];
    const students = [];

    const [course]: any = ((await db.execute(sql`select course_id from courses where course_code = ${e.courseCode}`)) as any).rows ?? [];
    if (!course) throw new Error(`course ${e.courseCode} not in DB`);
    const [clash]: any = ((await db.execute(sql`select intake_id, (select count(*)::int from enrollments where intake_id = ci.intake_id) n
      from course_intakes ci where course_id = ${course.course_id} and intake_number = ${e.intakeNumber}`)) as any).rows ?? [];
    if (clash) problems.push(`intake already exists: #${clash.intake_id} with ${clash.n} enrollments`);

    for (const r of data) {
      const rawArmy = String(r[cols.army]).trim();
      if (e.exclude?.includes(rawArmy)) {
        console.log(`  EXCLUDED ${rawArmy}`);
        continue;
      }
      const fullName = (cols.name >= 0
        ? String(r[cols.name])
        : [r[cols.first], r[cols.middle], r[cols.last]].map((x) => String(x ?? "").trim()).join(" ")
      ).replace(/\s+/g, " ").trim();
      const army =
        e.armyFix?.[`${rawArmy}|${fullName}`] ??
        e.armyFix?.[rawArmy] ??
        normalizeArmyNumber(rawArmy.replace(/\s+/g, " "));
      const total = cellNum(r[cols.total]);
      const grade = String(r[cols.grade] ?? "").trim().toUpperCase();
      const tag = `${army} ${fullName}`;
      if (!/^[A-Z]{1,3} \d{5,6}$/.test(army)) problems.push(`${tag}: army number format "${rawArmy}"`);
      if (!Number.isFinite(total) || total <= 0 || total > 100) problems.push(`${tag}: TOTAL "${r[cols.total]}"`);
      if (!REMARKS[grade]) problems.push(`${tag}: GRADE "${grade}"`);

      const theory = [];
      if (e.subjects) {
        let sum = 0;
        for (const [key, [name, weight]] of Object.entries(e.subjects)) {
          const fixed = e.markFix?.[army]?.[key];
          const raw = fixed ?? r[subjectCols.get(key)!];
          const marks = cellNum(raw);
          if (fixed != null) console.log(`  fix ${tag}: ${key} "${r[subjectCols.get(key)!]}" → ${fixed}`);
          if (!Number.isFinite(marks) || marks < 0) {
            problems.push(`${tag}: ${key} = "${raw}"`);
            continue;
          }
          if (marks > weight + 1e-9) {
            if (e.acceptOverWeight?.includes(`${army}:${key}`)) console.log(`  kept ${tag}: ${key} ${marks} > weight ${weight}`);
            else problems.push(`${tag}: ${key} ${marks} > weight ${weight}`);
          }
          if (String(raw).includes("..")) console.log(`  note ${tag}: ${key} "${raw}" read as ${marks}`);
          sum += marks;
          const pct = (marks / weight) * 100;
          theory.push({ name, theory: pct, practical: 0, total: pct, weight, marks });
        }
        if (Math.abs(sum - total) > 0.1) warnings.push(`${tag}: subject sum ${sum.toFixed(2)} ≠ TOTAL ${total}`);
      }
      students.push({
        armyNumber: army,
        rank: String(r[cols.rank] ?? "").trim().toUpperCase(),
        fullName,
        unit: cols.unit >= 0 ? String(r[cols.unit] ?? "").replace(/\s+/g, " ").trim() : "",
        courseRaw: e.courseName,
        intakeRaw: e.intakeNumber,
        startDate: e.startDate,
        endDate: e.endDate,
        overall: total,
        tpdfGrade: grade,
        tpdfRemarks: REMARKS[grade] ?? "",
        theory,
        field: [],
      });
    }

    const seen = new Map<string, number>();
    students.forEach((s) => seen.set(s.armyNumber, (seen.get(s.armyNumber) ?? 0) + 1));
    for (const [a, n] of seen) if (n > 1) problems.push(`${a}: appears ${n} times`);

    const nums = students.map((s) => s.armyNumber);
    const dbStudents: any[] = ((await db.execute(sql`select army_number, full_name from students
      where army_number in (${sql.join(nums.map((n) => sql`${n}`), sql`, `)})`)) as any).rows ?? [];
    const byArmy = new Map(dbStudents.map((x) => [x.army_number, x.full_name as string]));
    let existing = 0;
    for (const s of students) {
      const dbName = byArmy.get(s.armyNumber);
      if (!dbName) {
        const d = digits(s.armyNumber);
        const twins: any[] = ((await db.execute(sql`select army_number, full_name from students
          where regexp_replace(army_number, '\\D', '', 'g') = ${d} and army_number <> ${s.armyNumber}`)) as any).rows ?? [];
        const last = tokens(s.fullName).slice(-1)[0];
        const byName: any[] = last
          ? ((await db.execute(sql`select army_number, full_name from students
              where upper(full_name) like ${"%" + tokens(s.fullName)[0] + "%"} and upper(full_name) like ${"%" + last + "%"} limit 3`)) as any).rows ?? []
          : [];
        const hint = [...twins, ...byName].map((x) => `${x.army_number} "${x.full_name}"`).join("; ");
        console.log(`  NEW ${s.armyNumber} ${s.fullName} ${s.overall} ${s.tpdfGrade}${hint ? `   (DB has: ${hint})` : ""}`);
        const accepted = e.acceptArmy?.includes(s.armyNumber);
        if (!accepted && /^MTM? /.test(s.armyNumber) && !/^MTM? ([789]\d{4}|1\d{5})$/.test(s.armyNumber)) {
          problems.push(`${s.armyNumber} ${s.fullName}: implausible MT number and not in DB`);
        }
        if (twins.length && !accepted) problems.push(`${s.armyNumber}: same digits as ${twins.map((t) => t.army_number).join(",")}`);
        continue;
      }
      existing++;
      const common = tokens(dbName).filter((t) => tokens(s.fullName).includes(t)).length;
      if (common < 2) warnings.push(`${s.armyNumber}: file "${s.fullName}" vs DB "${dbName}"`);
    }

    console.log(`  students=${students.length} (existing ${existing}, new ${students.length - existing}), subjects=${e.subjects ? Object.keys(e.subjects).length : 0}`);
    if (warnings.length) {
      console.log(`  WARNINGS (${warnings.length}, not blocking):`);
      warnings.forEach((w) => console.log(`    - ${w}`));
    }
    if (problems.length) {
      console.log(`  PROBLEMS (${problems.length}):`);
      problems.forEach((p) => console.log(`    - ${p}`));
    }
    if (verify) {
      const [ik]: any = ((await db.execute(sql`select intake_id from course_intakes where course_id = ${course.course_id} and intake_number = ${e.intakeNumber}`)) as any).rows ?? [];
      if (!ik) { console.log("  VERIFY: intake not in DB"); continue; }
      const rows: any[] = ((await db.execute(sql`select e.student_army_number a, e.average_marks::text avg, e.grade::text g, e.position p,
          coalesce((select sum(r.marks_obtained) from results r where r.enrollment_id = e.enrollment_id), 0)::text rs,
          (select count(*)::int from results r where r.enrollment_id = e.enrollment_id) rn
        from enrollments e where e.intake_id = ${ik.intake_id}`)) as any).rows ?? [];
      const byA = new Map(rows.map((x) => [x.a, x]));
      let bad = 0;
      for (const s of students) {
        const d = byA.get(s.armyNumber);
        const fileSum = s.theory.reduce((a, t) => a + t.marks, 0);
        const errs: string[] = [];
        if (!d) errs.push("missing");
        else {
          if (Math.abs(+d.avg - Math.min(100, s.overall)) > 0.005) errs.push(`avg ${d.avg} vs ${s.overall}`);
          if (d.rn !== s.theory.length) errs.push(`results ${d.rn} vs ${s.theory.length}`);
          if (Math.abs(+d.rs - fileSum) > 0.02) errs.push(`marks sum ${d.rs} vs ${fileSum.toFixed(2)}`);
        }
        if (errs.length) { bad++; console.log(`  VERIFY ${s.armyNumber}: ${errs.join("; ")}`); }
      }
      const extra = rows.filter((x) => !students.some((s) => s.armyNumber === x.a));
      extra.forEach((x) => console.log(`  VERIFY extra in DB: ${x.a}`));
      const posOk = rows.every((x) => x.p === 1 + rows.filter((y) => +y.avg > +x.avg).length);
      console.log(`  VERIFY intake #${ik.intake_id}: db=${rows.length} file=${students.length} mismatches=${bad} extra=${extra.length} positions ${posOk ? "OK" : "WRONG"}`);
      continue;
    }
    if (dryRun) continue;
    if (problems.length) {
      console.log("  NOT IMPORTED — resolve problems first.");
      continue;
    }

    const summary = await importParsedSofaWorkbook(
      {
        filename: path.basename(e.file),
        courseCode: e.courseCode,
        courseName: e.courseName,
        intakeNumber: e.intakeNumber,
        year: e.year,
        startDate: e.startDate,
        endDate: e.endDate,
        durationWeeks: e.durationWeeks,
        students,
        skippedSheets: 0,
        warnings: [],
      },
      null,
      { keepExistingStudentDetails: true }
    );
    console.log(`  IMPORTED intake #${summary.intakeId}: ${summary.students} students, ${summary.results} results`);
    for (const a of e.overwriteStudent ?? []) {
      const s = students.find((x) => x.armyNumber === a);
      if (!s) throw new Error(`overwriteStudent ${a} not in table`);
      await db.execute(sql`update students set full_name = ${s.fullName}, rank = ${s.rank}, unit = ${s.unit} where army_number = ${a}`);
      console.log(`  student ${a} set to "${s.fullName}" ${s.rank} ${s.unit}`);
    }
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
