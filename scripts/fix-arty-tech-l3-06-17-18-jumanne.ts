/**
 * ARTY-TECH-L3 06/17-18 (#98): MT 100288 Jumanne Omary Jumanne.
 * His sheet in "ARTY TECH L-3 INT 06-17-18 (2).xlsx" uses another course's subject
 * weights and has TOTAL MARKS (%) = 0 / grade F, so the import summed it to 89.14.
 * The class summary (JIPYA/MADOGO DATABASE/AATC/KOZI YA AATC L-3 INT 06-17-18.xlsx)
 * gives 70.80 C with marks on the class subject template. Use that row.
 *
 *   npx tsx scripts/fix-arty-tech-l3-06-17-18-jumanne.ts --dry-run
 */
import "dotenv/config";
import { config } from "dotenv";
import * as XLSX from "xlsx";
import fs from "fs";

config({ path: ".env.local" });

const INTAKE_ID = 98;
const ARMY = "MT 100288";
const TEMPLATE_ARMY = "MT 102355";
const SUMMARY =
  "/home/nstumbantale/Desktop/JIPYA/MADOGO DATABASE/AATC/KOZI YA AATC L-3 INT 06-17-18.xlsx";
const COLUMN_TO_SUBJECT: Record<string, string> = {
  GM: "Gunnery Mathematics",
  DOP: "Duties at the Observation Post",
  DGE: "Duties at the Gun End",
  AT: "Artillery Instruments",
  AFCS: "Artillery Fire Control System",
  MU: "Map Using",
  SVY: "Survey",
  FD: "Fire Discipline",
  BLST: "Ballistics",
  AFOP: "Artillery Fire Orders Procedure",
  AMMO: "Ammunition",
  CIV: "Civics",
  IS: "Internal Security",
  MI: "Millitary Intelligency",
  WT: "Weekly Test",
  MT: "Monthly Test",
  HA: "Home Assignment",
};

async function main() {
  const dry = process.argv.includes("--dry-run");
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { sofaResultRows } = await import("../lib/utils/sofa-excel");
  const { tpdfGradeToSystem } = await import("../lib/utils/bcc-report");
  const { academicStatusFromAverage } = await import("../lib/utils/enrollment-status");
  const { DEFAULT_PASSING_MARK } = await import("../lib/utils/passing-mark");
  const { rankPositionsFromStoredAverages } = await import("../lib/utils/positions");
  const rows = async (q: ReturnType<typeof sql>) => {
    const r: any = await db.execute(q);
    return (r.rows ?? r) as any[];
  };

  const wb = XLSX.read(fs.readFileSync(SUMMARY));
  const sheet: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, defval: "" });
  const hi = sheet.findIndex((r) => r.some((c) => String(c).trim() === "TOTAL"));
  const header = sheet[hi].map((c) => String(c).trim().toUpperCase());
  const row = sheet.find((r) => String(r[1]).replace(/\D/g, "") === "100288");
  if (!row || !/JUMANNE OMARY JUMANNE/i.test(String(row[3]))) throw new Error("Summary row not found");
  const total = Number(row[header.indexOf("TOTAL")]);
  const grade = String(row[header.indexOf("GRADE")]).trim();

  const template = await rows(sql`select r.subject_name, r.max_marks::float w from results r
    join enrollments e on e.enrollment_id = r.enrollment_id
    where e.intake_id = ${INTAKE_ID} and e.student_army_number = ${TEMPLATE_ARMY} order by r.result_id`);
  const weight = new Map(template.map((t) => [t.subject_name, t.w]));

  const theory = Object.entries(COLUMN_TO_SUBJECT).map(([col, name]) => {
    const marks = Number(row[header.indexOf(col)]);
    const w = weight.get(name);
    if (!w || !Number.isFinite(marks) || marks > w) throw new Error(`Bad subject ${col}/${name}: ${marks}/${w}`);
    const pct = +((marks / w) * 100).toFixed(2);
    return { name, theory: pct, practical: null, total: pct, weight: w, marks };
  });
  const sum = theory.reduce((a, t) => a + t.marks, 0);
  if (theory.length !== template.length || Math.abs(sum - total) > 0.05) {
    throw new Error(`Subject check failed: n=${theory.length}/${template.length} sum=${sum} total=${total}`);
  }

  const [enr] = await rows(sql`select enrollment_id, average_marks::text avg, grade, position from enrollments
    where intake_id = ${INTAKE_ID} and student_army_number = ${ARMY}`);
  if (!enr) throw new Error("Enrollment not found");
  const resultRows = sofaResultRows({ theory, field: [], tpdfGrade: grade, tpdfRemarks: "Good" } as any);
  const systemGrade = tpdfGradeToSystem(grade);
  const status = academicStatusFromAverage(total, DEFAULT_PASSING_MARK) ?? "completed";

  console.log(`${dry ? "[dry] " : ""}${ARMY} enrollment #${enr.enrollment_id}: avg ${enr.avg} ${enr.grade} pos ${enr.position} → ${total.toFixed(2)} ${systemGrade} (${status}), ${resultRows.length} subjects, sum ${sum.toFixed(2)}`);
  for (const r of resultRows) console.log(`   ${r.subjectName} ${r.marksObtained}/${r.maxMarks} ${r.grade}`);
  if (dry) return;

  await db.batch([
    db.execute(sql`delete from results where enrollment_id = ${enr.enrollment_id}`),
    ...resultRows.map((r) =>
      db.execute(sql`insert into results (enrollment_id, subject_name, marks_obtained, max_marks, grade, remarks)
        values (${enr.enrollment_id}, ${r.subjectName}, ${r.marksObtained}, ${r.maxMarks}, ${r.grade}, ${r.remarks})`)
    ),
    db.execute(sql`update enrollments set average_marks = ${total.toFixed(2)}, total_marks = ${total.toFixed(2)},
      grade = ${systemGrade}, status = ${status}, updated_at = now() where enrollment_id = ${enr.enrollment_id}`),
  ] as any);
  await rankPositionsFromStoredAverages(INTAKE_ID);
  const [after] = await rows(sql`select average_marks::text avg, grade, position,
    (select count(*)::int from results where enrollment_id = ${enr.enrollment_id}) n
    from enrollments where enrollment_id = ${enr.enrollment_id}`);
  console.log("after:", after);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
