/**
 * Ensure ASVY-L1, ASVY-L2, ASVY-L3 course folders exist.
 * Run: npx tsx scripts/ensure-asvy-levels.ts
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
  await ensure("ASVY-L1", "Artillery Survey Level 1", 12);
  await ensure("ASVY-L2", "Artillery Survey Level 2", 16);
  await ensure("ASVY-L3", "Artillery Survey Level 3", 20);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
