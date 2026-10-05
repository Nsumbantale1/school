/**
 * Merges battery streams of one intake (e.g. "21/19-P", "21/19-Q", "21/19-R")
 * into a single intake "21/19". The P intake (or an existing base intake) is
 * kept; other streams' enrollments move into it, then positions are re-ranked
 * across the whole intake from stored (Excel) averages.
 *
 * The original stream of every enrollment is saved to data/stream-merge-<date>.json.
 *
 *   npx tsx scripts/merge-stream-intakes.ts --dry-run
 *   npx tsx scripts/merge-stream-intakes.ts [--only=ARTY-L2]
 */
import "dotenv/config";
import { config } from "dotenv";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

config({ path: ".env.local" });

const STREAM_SUFFIX = /-([PQRT])$/i;

type IntakeRow = {
  intake_id: number;
  course_id: number;
  course_code: string;
  intake_number: string;
  year: number;
  start_date: string;
  end_date: string | null;
};

async function main() {
  const dry = process.argv.includes("--dry-run");
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { rankPositionsFromStoredAverages } = await import("../lib/utils/positions");
  const rows = async <T = any>(q: ReturnType<typeof sql>) => {
    const r: any = await db.execute(q);
    return (r.rows ?? r) as T[];
  };

  const intakes = await rows<IntakeRow>(sql`select ci.intake_id, ci.course_id, c.course_code,
      ci.intake_number, ci.year, ci.start_date::text start_date, ci.end_date::text end_date
    from course_intakes ci join courses c on c.course_id = ci.course_id
    order by c.course_code, ci.intake_number`);

  const groups = new Map<string, { base: string; members: IntakeRow[] }>();
  for (const it of intakes) {
    const base = it.intake_number.trim().replace(STREAM_SUFFIX, "");
    const key = `${it.course_id}|${base}`;
    if (!groups.has(key)) groups.set(key, { base, members: [] });
    groups.get(key)!.members.push(it);
  }

  const todo = [...groups.values()].filter(
    (g) =>
      g.members.some((m) => STREAM_SUFFIX.test(m.intake_number.trim())) &&
      (!only || g.members[0].course_code === only)
  );

  const record: any[] = [];
  const plans: Array<() => Promise<void>> = [];
  let problems = 0;

  for (const g of todo) {
    const code = g.members[0].course_code;
    const baseRow = g.members.find((m) => m.intake_number.trim() === g.base);
    const streams = g.members
      .filter((m) => m !== baseRow)
      .sort((a, b) => a.intake_number.localeCompare(b.intake_number));
    const keep = baseRow ?? streams[0];
    const move = g.members.filter((m) => m !== keep);
    const ids = g.members.map((m) => m.intake_id);
    const idList = sql.join(ids.map((n) => sql`${n}`), sql`, `);

    const years = new Set(g.members.map((m) => m.year));
    const dup = await rows(sql`select student_army_number a, count(*)::int n
      from enrollments where intake_id in (${idList}) group by 1 having count(*) > 1`);
    const clash = await rows(sql`select intake_id from course_intakes
      where course_id = ${keep.course_id} and intake_number = ${g.base} and intake_id <> ${keep.intake_id}`);

    const label = `${code} ${g.members.map((m) => `#${m.intake_id} ${m.intake_number}`).join(" + ")} → "${g.base}" (keep #${keep.intake_id})`;
    if (dup.length || clash.length || years.size > 1) {
      problems++;
      console.log(`SKIP ${label}`);
      if (dup.length) console.log(`   students in more than one stream: ${dup.map((d) => d.a).join(", ")}`);
      if (clash.length) console.log(`   intake "${g.base}" already exists: #${clash[0].intake_id}`);
      if (years.size > 1) console.log(`   different years: ${[...years].join(", ")}`);
      continue;
    }

    const enr = await rows(sql`select e.enrollment_id, e.student_army_number, e.intake_id,
        e.position, e.average_marks::text average_marks
      from enrollments e where e.intake_id in (${idList}) order by e.intake_id, e.position nulls last`);
    const numberOf = new Map(g.members.map((m) => [m.intake_id, m.intake_number]));
    const counts = g.members.map((m) => `${m.intake_number}:${enr.filter((e) => e.intake_id === m.intake_id).length}`);

    const starts = g.members.map((m) => m.start_date).sort();
    const ends = g.members.map((m) => m.end_date).filter(Boolean).sort() as string[];
    const start = starts[0];
    const end = ends.length ? ends[ends.length - 1] : null;

    console.log(`${dry ? "[dry] " : ""}${label}  n=${enr.length} (${counts.join(", ")})  ${start} → ${end ?? "—"}`);

    for (const e of enr) {
      record.push({
        course: code,
        intake: g.base,
        intakeId: keep.intake_id,
        enrollmentId: e.enrollment_id,
        armyNumber: e.student_army_number,
        stream: numberOf.get(e.intake_id)!.match(STREAM_SUFFIX)?.[1]?.toUpperCase() ?? null,
        originalIntakeId: e.intake_id,
        originalIntakeNumber: numberOf.get(e.intake_id),
        originalPosition: e.position,
        averageMarks: e.average_marks,
      });
    }

    plans.push(async () => {
    const moveIds = move.map((m) => m.intake_id);
    if (moveIds.length) {
      const moveList = sql.join(moveIds.map((n) => sql`${n}`), sql`, `);
      await db.batch([
        db.execute(sql`update enrollments set intake_id = ${keep.intake_id}, updated_at = now()
          where intake_id in (${moveList})`),
        db.execute(sql`update certificate_requests set intake_id = ${keep.intake_id}
          where intake_id in (${moveList})`),
        db.execute(sql`delete from course_intakes where intake_id in (${moveList})
          and not exists (select 1 from enrollments e where e.intake_id = course_intakes.intake_id)`),
        db.execute(sql`update course_intakes set intake_number = ${g.base}, start_date = ${start},
          end_date = ${end}, updated_at = now() where intake_id = ${keep.intake_id}`),
      ] as any);
    } else {
      await db.execute(sql`update course_intakes set intake_number = ${g.base}, updated_at = now()
        where intake_id = ${keep.intake_id}`);
    }
    await rankPositionsFromStoredAverages(keep.intake_id);

    const [after] = await rows(sql`select
      (select count(*)::int from enrollments where intake_id = ${keep.intake_id}) n,
      (select count(*)::int from course_intakes where intake_id in (${idList})) left_intakes`);
    if (after.n !== enr.length || after.left_intakes !== 1) {
      throw new Error(`Verification failed for ${label}: ${JSON.stringify(after)} expected n=${enr.length}`);
    }
    console.log(`   merged ${label}`);
    });
  }

  console.log(`${todo.length} group(s), ${problems} skipped, ${record.length} enrollment(s)`);
  if (dry || !plans.length) return;

  const involved = [...new Set(record.map((r) => r.originalIntakeId))];
  const invList = sql.join(involved.map((n) => sql`${n}`), sql`, `);
  const snapshot = {
    intakes: await rows(sql`select * from course_intakes where intake_id in (${invList})`),
    certificateRequests: await rows(sql`select * from certificate_requests where intake_id in (${invList})`),
    enrollments: record,
  };
  const dir = path.join(process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `stream-merge-${new Date().toISOString().replace(/[:.]/g, "-")}${only ? `-${only}` : ""}.json`);
  await writeFile(file, JSON.stringify(snapshot, null, 1));
  console.log(`saved pre-merge snapshot → ${file}`);

  for (const run of plans) await run();
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
