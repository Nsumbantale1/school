import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const before = await db.execute(sql`
    SELECT to_regclass('public.progress_tests')::text AS reg
  `);
  console.log("before", JSON.stringify(before));
  const { ensureProgressTestsTable } = await import("../lib/db/ensure-progress-tests");
  await ensureProgressTestsTable();
  const after = await db.execute(sql`
    SELECT to_regclass('public.progress_tests')::text AS reg
  `);
  console.log("after", JSON.stringify(after));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
