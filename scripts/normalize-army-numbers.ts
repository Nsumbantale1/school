/**
 * Normalises army numbers to "PREFIX DIGITS" (e.g. "P10868" → "P 10868",
 * "MT 128933'" → "MT 128933", bare "79772" → "MT 79772" for soldier courses)
 * and merges the student record into an existing twin with the same number.
 *
 * Same-intake duplicates (one person enrolled twice under both spellings):
 *   - intakes in KEEP_MALFORMED keep the malformed-number enrollment
 *     (it came from the official course report import);
 *   - otherwise the averages must agree and the enrollment with more result rows is kept.
 *
 * Everything touched is saved to data/army-cleanup-<timestamp>.json first.
 *
 *   npx tsx scripts/normalize-army-numbers.ts --dry-run
 */
import "dotenv/config";
import { config } from "dotenv";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

config({ path: ".env.local" });

/** FAOC 04/19-20: "P10130"-style rows match FAOAC INT 04-19-20.xlsx; "P 10130" rows are an older import. */
const KEEP_MALFORMED = new Set([70]);
const SOLDIER_COURSE = /^(ARTY-L\d|ARTY-TECH-L\d|AAT-L\d|GT-L\d|ASVY-L\d)$/;
const SKIP = new Set(["OBGC1718-092"]);

type Student = { army_number: string; full_name: string; rank: string | null; unit: string | null };
type Enr = { enrollment_id: number; intake_id: number; student_army_number: string; avg: string | null; nres: number; course_code: string; intake_number: string };

function nameScore(n: string) {
  return n.split(/\s+/).filter((t) => t.replace(/[^A-Za-z]/g, "").length >= 3).length;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { rankPositionsFromStoredAverages } = await import("../lib/utils/positions");
  const rows = async <T = any>(q: ReturnType<typeof sql>) => {
    const r: any = await db.execute(q);
    return (r.rows ?? r) as T[];
  };

  const bad = await rows<Student>(sql`select army_number, full_name, rank, unit from students
    where army_number !~ '^[A-Z]{1,3} [0-9]+$' order by army_number`);

  const plans: Array<{ from: Student; to: string; twin: Student | null; name: string; dropEnrollments: number[]; rerank: number[] }> = [];
  const problems: string[] = [];

  for (const s of bad) {
    if (SKIP.has(s.army_number)) continue;
    const cleaned = s.army_number.toUpperCase().replace(/['`\s]+$/g, "").trim();
    const m = cleaned.match(/^([A-Z]{1,3})\s*(\d+)$/);
    const digits = cleaned.replace(/\D/g, "");
    const enr = await rows<Enr>(sql`select e.enrollment_id, e.intake_id, e.student_army_number, e.average_marks::text avg,
        (select count(*)::int from results r where r.enrollment_id = e.enrollment_id) nres, c.course_code, ci.intake_number
      from enrollments e join course_intakes ci on ci.intake_id = e.intake_id join courses c on c.course_id = ci.course_id
      where e.student_army_number = ${s.army_number}`);

    const twins = await rows<Student>(sql`select army_number, full_name, rank, unit from students
      where army_number ~ '^[A-Z]{1,3} [0-9]+$' and regexp_replace(army_number, '\\D', '', 'g') = ${digits}`);
    let to: string | null = m ? `${m[1]} ${m[2]}` : null;
    if (!m && /^\d+$/.test(cleaned)) {
      if (twins.length === 1) to = twins[0].army_number;
      else if (twins.length === 0 && enr.length && enr.every((e) => SOLDIER_COURSE.test(e.course_code))) to = `MT ${digits}`;
    }
    if (!to) { problems.push(`${s.army_number} "${s.full_name}": cannot decide prefix (twins: ${twins.map((t) => t.army_number).join(", ") || "none"})`); continue; }
    const twin = twins.find((t) => t.army_number === to) ?? null;
    if (twins.length && !twin) { problems.push(`${s.army_number} → ${to}: twin with other prefix ${twins.map((t) => t.army_number).join(", ")}`); continue; }

    const dropEnrollments: number[] = [];
    const rerank: number[] = [];
    if (twin) {
      const twinEnr = await rows<Enr>(sql`select e.enrollment_id, e.intake_id, e.student_army_number, e.average_marks::text avg,
          (select count(*)::int from results r where r.enrollment_id = e.enrollment_id) nres, c.course_code, ci.intake_number
        from enrollments e join course_intakes ci on ci.intake_id = e.intake_id join courses c on c.course_id = ci.course_id
        where e.student_army_number = ${twin.army_number}`);
      for (const e of enr) {
        const t = twinEnr.find((x) => x.intake_id === e.intake_id);
        if (!t) continue;
        rerank.push(e.intake_id);
        if (KEEP_MALFORMED.has(e.intake_id)) { dropEnrollments.push(t.enrollment_id); continue; }
        if (e.avg !== t.avg) { problems.push(`${s.army_number}/${twin.army_number} in ${e.course_code} ${e.intake_number}: averages differ ${e.avg} vs ${t.avg}`); continue; }
        dropEnrollments.push(e.nres > t.nres ? t.enrollment_id : e.enrollment_id);
      }
    }
    const name = twin && nameScore(twin.full_name) >= nameScore(s.full_name) ? twin.full_name : s.full_name;
    plans.push({ from: s, to, twin, name, dropEnrollments, rerank });
    console.log(`${dry ? "[dry] " : ""}${JSON.stringify(s.army_number)} → "${to}" ${twin ? "MERGE" : "RENAME"} name="${name}"` +
      ` [${enr.map((e) => `${e.course_code} ${e.intake_number}`).join(", ")}]` +
      (twin ? ` into "${twin.full_name}"` : "") +
      (dropEnrollments.length ? `  drop duplicate enrollment(s) ${dropEnrollments.join(",")}` : ""));
  }

  console.log(`\n${plans.length} to fix (${plans.filter((p) => p.twin).length} merges, ${plans.filter((p) => !p.twin).length} renames), ${plans.reduce((a, p) => a + p.dropEnrollments.length, 0)} duplicate enrollments`);
  for (const p of problems) console.log(`PROBLEM ${p}`);
  if (problems.length) { console.log("Stopping: resolve problems first."); return; }
  if (dry) return;

  const armies = plans.flatMap((p) => [p.from.army_number, p.to]);
  const aList = sql.join(armies.map((a) => sql`${a}`), sql`, `);
  const drops = plans.flatMap((p) => p.dropEnrollments);
  const dList = drops.length ? sql.join(drops.map((n) => sql`${n}`), sql`, `) : sql`-1`;
  const snapshot = {
    students: await rows(sql`select * from students where army_number in (${aList})`),
    enrollments: await rows(sql`select * from enrollments where student_army_number in (${aList})`),
    droppedResults: await rows(sql`select * from results where enrollment_id in (${dList})`),
    documents: await rows(sql`select * from documents where student_army_number in (${aList})`),
    plans: plans.map((p) => ({ from: p.from.army_number, to: p.to, merge: !!p.twin, name: p.name, dropEnrollments: p.dropEnrollments })),
  };
  const guard = await rows(sql`select
    (select count(*)::int from certificates where enrollment_id in (${dList})) c,
    (select count(*)::int from certificate_request_items where enrollment_id in (${dList})) r,
    (select count(*)::int from documents where enrollment_id in (${dList})) d`);
  if (guard[0].c || guard[0].r || guard[0].d) throw new Error(`Duplicate enrollments have certificates: ${JSON.stringify(guard[0])}`);

  const dir = path.join(process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `army-cleanup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(file, JSON.stringify(snapshot, null, 1));
  console.log(`saved snapshot → ${file}`);

  const rerank = new Set<number>();
  for (const p of plans) {
    const from = p.from.army_number;
    const dropList = p.dropEnrollments.length ? sql.join(p.dropEnrollments.map((n) => sql`${n}`), sql`, `) : sql`-1`;
    const steps: any[] = [db.execute(sql`delete from enrollments where enrollment_id in (${dropList})`)];
    if (!p.twin) {
      steps.push(db.execute(sql`insert into students (army_number, full_name, rank, gender, unit, date_of_birth, phone, email, notes, is_active, created_at, updated_at)
        select ${p.to}, full_name, rank, gender, unit, date_of_birth, phone, email, notes, is_active, created_at, now() from students where army_number = ${from}`));
    } else {
      steps.push(db.execute(sql`update students t set full_name = ${p.name},
        rank = coalesce(t.rank, f.rank), unit = coalesce(t.unit, f.unit), updated_at = now()
        from students f where t.army_number = ${p.to} and f.army_number = ${from}`));
    }
    steps.push(
      db.execute(sql`update enrollments set student_army_number = ${p.to}, updated_at = now() where student_army_number = ${from}`),
      db.execute(sql`update documents set student_army_number = ${p.to} where student_army_number = ${from}`),
      db.execute(sql`update certificate_request_items set student_army_number = ${p.to} where student_army_number = ${from}`),
      db.execute(sql`delete from students where army_number = ${from}`),
    );
    await db.batch(steps as any);
    p.rerank.forEach((i) => rerank.add(i));
    console.log(`   fixed ${JSON.stringify(from)} → "${p.to}"`);
  }
  for (const id of rerank) await rankPositionsFromStoredAverages(id);
  console.log(`re-ranked intakes: ${[...rerank].join(", ") || "none"}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
