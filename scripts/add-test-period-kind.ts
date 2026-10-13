import { readFileSync, existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function databaseUrl(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((row) => row.startsWith("DATABASE_URL="));
  if (!line) return undefined;
  let value = line.slice("DATABASE_URL=".length).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value || undefined;
}

async function ensureColumn(label: string, url: string) {
  const sql = neon(url);
  await sql`
    ALTER TABLE course_exercises
    ADD COLUMN IF NOT EXISTS period_kind varchar(16) NOT NULL DEFAULT 'week'
  `;
  const rows = await sql`
    SELECT table_schema, column_name
    FROM information_schema.columns
    WHERE table_name = 'course_exercises' AND column_name = 'period_kind'
  `;
  const probe = await sql`
    SELECT "course_id", "week_number", "period_kind", count(*)::int
    FROM "course_exercises"
    GROUP BY "course_exercises"."course_id", "course_exercises"."week_number", "course_exercises"."period_kind"
    LIMIT 1
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS progress_tests (
      id serial PRIMARY KEY,
      enrollment_id integer NOT NULL REFERENCES enrollments(enrollment_id) ON DELETE CASCADE,
      kind varchar(16) NOT NULL,
      period smallint NOT NULL,
      marks numeric(6, 2) NOT NULL,
      updated_by integer REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT idx_progress_test_unique UNIQUE (enrollment_id, kind, period)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_progress_test_enrollment
    ON progress_tests (enrollment_id)
  `;
  const table = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'progress_tests'
  `;
  console.log(
    `${label}: period_kind ${rows.length ? "present" : "missing"} in ${rows.map((row) => row.table_schema).join(", ") || "none"}; probe rows ${probe.length}; progress_tests ${table.length ? "present" : "missing"}`
  );
}

async function main() {
  const urls = [
    [".env.local", databaseUrl(".env.local")],
    [".env", databaseUrl(".env")],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const seen = new Set<string>();
  for (const [label, url] of urls) {
    if (seen.has(url)) {
      console.log(`${label}: same database, skipped`);
      continue;
    }
    seen.add(url);
    await ensureColumn(label, url);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
