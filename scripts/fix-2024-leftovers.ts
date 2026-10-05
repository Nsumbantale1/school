/**
 * - Removes draft-typo students left in ARTY-L3 25/23-24 P/Q after re-import from the complete workbook.
 * - Clears the 0.00 average given to OBGC 24-24 students who have no marks at all.
 *
 *   npx tsx scripts/fix-2024-leftovers.ts --dry-run
 *   npx tsx scripts/fix-2024-leftovers.ts
 */
import "dotenv/config";
import { config } from "dotenv";

config({ path: ".env.local" });

const DRAFT_TYPOS: Array<{ intakeId: number; army: string; correct: string }> = [
  { intakeId: 128, army: "MT 1337055", correct: "MT 137055" },
  { intakeId: 129, army: "MT 133867", correct: "MT 133865" },
  { intakeId: 129, army: "MT 136335", correct: "MT 136935" },
  { intakeId: 129, army: "MT 1334057", correct: "MT 134257" },
];
const NO_MARKS = { intakeId: 50, armies: ["P 16056", "P 15440"] };

async function main() {
  const dry = process.argv.includes("--dry-run");
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { rankPositionsFromStoredAverages } = await import("../lib/utils/positions");
  const rows = async (q: ReturnType<typeof sql>) => {
    const r: any = await db.execute(q);
    return (r.rows ?? r) as any[];
  };

  for (const t of DRAFT_TYPOS) {
    const [c] = await rows(sql`select
      (select count(*)::int from enrollments where student_army_number = ${t.correct} and intake_id = ${t.intakeId}) correct_in,
      (select count(*)::int from enrollments where student_army_number = ${t.army}) typo_enr,
      (select created_at::date::text from students where army_number = ${t.army}) created`);
    if (c.correct_in !== 1 || c.typo_enr > 1 || (c.created && c.created !== "2026-09-24")) {
      throw new Error(`Safety check failed for ${t.army}: ${JSON.stringify(c)}`);
    }
    console.log(`${dry ? "[dry] " : ""}remove ${t.army} from #${t.intakeId} (correct ${t.correct} present)`);
    if (!dry) {
      await db.execute(sql`delete from enrollments where student_army_number = ${t.army} and intake_id = ${t.intakeId}`);
      await db.execute(sql`delete from students where army_number = ${t.army}`);
    }
  }

  for (const a of NO_MARKS.armies) {
    const [c] = await rows(sql`select
      (select count(*)::int from results r join enrollments e on e.enrollment_id = r.enrollment_id
         where e.intake_id = ${NO_MARKS.intakeId} and e.student_army_number = ${a} and coalesce(r.marks_obtained, 0) <> 0) nonzero`);
    if (c.nonzero !== 0) throw new Error(`${a} has non-zero results: ${c.nonzero}`);
    console.log(`${dry ? "[dry] " : ""}clear average/grade/position for ${a} in #${NO_MARKS.intakeId}`);
    if (!dry) {
      await db.execute(sql`update enrollments set average_marks = null, total_marks = null, grade = null, position = null, updated_at = now()
        where intake_id = ${NO_MARKS.intakeId} and student_army_number = ${a}`);
    }
  }

  if (!dry) {
    for (const id of [128, 129, 50]) await rankPositionsFromStoredAverages(id);
    console.log("re-ranked #128, #129, #50");
  }
  console.log("done");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
