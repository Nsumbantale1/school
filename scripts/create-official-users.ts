/**
 * Create Chief Instructor & Commandant login accounts (separate users).
 *
 *   npx tsx scripts/create-official-users.ts
 *
 * Passwords via env (recommended) or defaults for local only:
 *   SEED_CI_PASSWORD / SEED_COMMANDANT_PASSWORD
 */

import "dotenv/config";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { hashPassword } from "../lib/auth/session";

config({ path: ".env.local" });

async function upsertOfficial(opts: {
  username: string;
  name: string;
  role: "chief_instructor" | "commandant";
  password: string;
}) {
  const passwordHash = await hashPassword(opts.password);
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, opts.username))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        name: opts.name,
        role: opts.role,
        passwordHash,
        isActive: true,
      })
      .where(eq(users.id, existing.id));
    console.log(`Updated user "${opts.username}" (${opts.role})`);
    return;
  }

  await db.insert(users).values({
    username: opts.username,
    name: opts.name,
    role: opts.role,
    passwordHash,
    isActive: true,
  });
  console.log(`Created user "${opts.username}" (${opts.role})`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  const ciPassword = process.env.SEED_CI_PASSWORD || "chief123";
  const cmdPassword = process.env.SEED_COMMANDANT_PASSWORD || "cmdt123";

  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.SEED_CI_PASSWORD || !process.env.SEED_COMMANDANT_PASSWORD)
  ) {
    console.error(
      "In production set SEED_CI_PASSWORD and SEED_COMMANDANT_PASSWORD."
    );
    process.exit(1);
  }

  if (ciPassword === "chief123" || cmdPassword === "cmdt123") {
    console.warn(
      "WARNING: Using weak default passwords. Change them after first login."
    );
  }

  await upsertOfficial({
    username: "chief",
    name: "Chief Instructor",
    role: "chief_instructor",
    password: ciPassword,
  });
  await upsertOfficial({
    username: "commandant",
    name: "Commandant",
    role: "commandant",
    password: cmdPassword,
  });

  console.log("\nDone. Login accounts:");
  console.log("  chief / <CI password>");
  console.log("  commandant / <Commandant password>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
