/**
 * Ensure ARTY-TECH-L1/L2/L3 course folders exist.
 * Run: npx tsx scripts/ensure-arty-tech-levels.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { courses } from "../lib/db/schema";

async function ensure(code: string, name: string, weeks: number) {
  const [existing] = await db
    .select()
    .from(courses)
    .where(eq(courses.courseCode, code))
    .limit(1);
  if (existing) {
    await db
      .update(courses)
      .set({
        courseName: name,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(courses.courseId, existing.courseId));
    console.log(`keep ${code} (id ${existing.courseId})`);
    return;
  }
  const [created] = await db
    .insert(courses)
    .values({
      courseCode: code,
      courseName: name,
      description: `${name}.`,
      durationWeeks: weeks,
      passingMark: 50,
      isActive: true,
    })
    .returning({ id: courses.courseId });
  console.log(`created ${code} (id ${created.id})`);
}

async function main() {
  await ensure("ARTY-TECH-L1", "Artillery Technician Level 1", 16);
  await ensure("ARTY-TECH-L2", "Artillery Technician Level 2", 20);
  await ensure("ARTY-TECH-L3", "Artillery Technician Level 3", 24);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
