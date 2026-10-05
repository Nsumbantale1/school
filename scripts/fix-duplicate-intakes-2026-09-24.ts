/**
 * Removes duplicate intakes created on 2026-09-24 by the 2019/2023 JIPYA imports
 * (the same cohorts already existed under slightly different intake numbers),
 * the prefix-less student records they created, and merges 113021 → MT 113021.
 *
 *   npx tsx scripts/fix-duplicate-intakes-2026-09-24.ts --dry-run
 *   npx tsx scripts/fix-duplicate-intakes-2026-09-24.ts
 */
import "dotenv/config";
import { config } from "dotenv";

config({ path: ".env.local" });

const DUPLICATES: Array<{ remove: number; keep: number; course: string; removeNumber: string }> = [
  { remove: 113, keep: 67, course: "RSOC", removeNumber: "05/19-20" },
  { remove: 130, keep: 41, course: "OBGC", removeNumber: "SPECIAL-01/23-24" },
  { remove: 131, keep: 39, course: "ARTY-L3", removeNumber: "SPECIAL-01/23-24" },
  { remove: 132, keep: 40, course: "FAOC", removeNumber: "05/22-23" },
];
const BOGUS_STUDENTS = ["13113", "13156", "13571"];
const MERGE = { from: "113021", to: "MT 113021", intakeId: 93 };

async function main() {
  const dry = process.argv.includes("--dry-run");
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const rows = async (q: ReturnType<typeof sql>) => {
    const r: any = await db.execute(q);
    return (r.rows ?? r) as any[];
  };

  for (const d of DUPLICATES) {
    const [rm] = await rows(sql`select ci.intake_number, c.course_code, ci.created_at::date::text created
      from course_intakes ci join courses c on c.course_id = ci.course_id where ci.intake_id = ${d.remove}`);
    const [kp] = await rows(sql`select count(*)::int n from enrollments where intake_id = ${d.keep}`);
    if (!rm) { console.log(`#${d.remove} already gone`); continue; }
    if (rm.course_code !== d.course || rm.intake_number !== d.removeNumber || rm.created !== "2026-09-24" || !kp?.n) {
      throw new Error(`Safety check failed for #${d.remove}: ${JSON.stringify(rm)} keep n=${kp?.n}`);
    }
    console.log(`${dry ? "[dry] " : ""}delete intake #${d.remove} ${d.course} ${d.removeNumber} (keep #${d.keep}, n=${kp.n})`);
    if (!dry) await db.execute(sql`delete from course_intakes where intake_id = ${d.remove}`);
  }

  for (const a of BOGUS_STUDENTS) {
    const [c] = await rows(sql`select
      (select count(*)::int from enrollments where student_army_number = ${a} and intake_id <> 113) other,
      (select count(*)::int from students where army_number = ${"P " + a}) twin`);
    if (c.other > 0 || c.twin !== 1) throw new Error(`Safety check failed for student ${a}: ${JSON.stringify(c)}`);
    console.log(`${dry ? "[dry] " : ""}delete student ${a} (twin P ${a} kept)`);
    if (!dry) await db.execute(sql`delete from students where army_number = ${a}`);
  }

  const [m] = await rows(sql`select
    (select count(*)::int from enrollments where student_army_number = ${MERGE.from}) from_n,
    (select count(*)::int from enrollments where student_army_number = ${MERGE.to} and intake_id = ${MERGE.intakeId}) clash,
    (select count(*)::int from students where army_number = ${MERGE.to}) to_exists`);
  if (m.to_exists !== 1 || m.clash !== 0 || m.from_n > 1) throw new Error(`Merge safety check failed: ${JSON.stringify(m)}`);
  console.log(`${dry ? "[dry] " : ""}move ${m.from_n} enrollment(s) ${MERGE.from} → ${MERGE.to}, delete ${MERGE.from}`);
  if (!dry) {
    await db.execute(sql`update enrollments set student_army_number = ${MERGE.to}, updated_at = now() where student_army_number = ${MERGE.from}`);
    await db.execute(sql`delete from students where army_number = ${MERGE.from}`);
  }
  console.log("done");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
