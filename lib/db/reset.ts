import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function reset() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("=== Resetting Database ===\n");

  // Drop all tables in reverse dependency order
  console.log("Dropping tables...");
  await sql`DROP TABLE IF EXISTS login_logs CASCADE`;
  await sql`DROP TABLE IF EXISTS audit_logs CASCADE`;
  await sql`DROP TABLE IF EXISTS documents CASCADE`;
  await sql`DROP TABLE IF EXISTS exam_results CASCADE`;
  await sql`DROP TABLE IF EXISTS results CASCADE`;
  await sql`DROP TABLE IF EXISTS enrollments CASCADE`;
  await sql`DROP TABLE IF EXISTS course_prerequisites CASCADE`;
  await sql`DROP TABLE IF EXISTS course_intakes CASCADE`;
  await sql`DROP TABLE IF EXISTS course_subjects CASCADE`;
  await sql`DROP TABLE IF EXISTS courses CASCADE`;
  await sql`DROP TABLE IF EXISTS subjects CASCADE`;
  await sql`DROP TABLE IF EXISTS wings CASCADE`;
  await sql`DROP TABLE IF EXISTS personnel CASCADE`;
  await sql`DROP TABLE IF EXISTS students CASCADE`;
  await sql`DROP TABLE IF EXISTS users CASCADE`;
  console.log("   Tables dropped.\n");

  // Drop all enums
  console.log("Dropping enums...");
  await sql`DROP TYPE IF EXISTS audit_action CASCADE`;
  await sql`DROP TYPE IF EXISTS grade CASCADE`;
  await sql`DROP TYPE IF EXISTS user_role CASCADE`;
  await sql`DROP TYPE IF EXISTS enrollment_status CASCADE`;
  await sql`DROP TYPE IF EXISTS exam_type CASCADE`;
  await sql`DROP TYPE IF EXISTS gender_type CASCADE`;
  await sql`DROP TYPE IF EXISTS personnel_category CASCADE`;
  console.log("   Enums dropped.\n");

  // Drop migration table
  console.log("Dropping migration table...");
  await sql`DROP TABLE IF EXISTS __drizzle_migrations CASCADE`;
  console.log("   Migration table dropped.\n");

  console.log("=== Database Reset Complete ===");
  console.log("\nNext steps:");
  console.log("  1. Run: bun drizzle-kit migrate");
  console.log("  2. Run: bun run db:seed");
}

reset().catch(console.error);
