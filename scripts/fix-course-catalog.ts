/**
 * One-off data cleanup for course folders:
 * - Merge FAOC1 + FAOAC → FAOC
 * - Merge RO0G2025 into ROG → ROGC
 * - Ensure AAT-L1 (AATC-L1) and GT-L1 exist
 *
 * Run: npx tsx scripts/fix-course-catalog.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "../lib/db";
import {
  courses,
  courseIntakes,
  courseSubjects,
  coursePrerequisites,
  courseNotices,
  courseExercises,
  users,
} from "../lib/db/schema";

async function ensureCourse(opts: {
  code: string;
  name: string;
  durationWeeks: number;
  description: string;
}) {
  const [existing] = await db
    .select()
    .from(courses)
    .where(eq(courses.courseCode, opts.code))
    .limit(1);
  if (existing) {
    await db
      .update(courses)
      .set({
        courseName: opts.name,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(courses.courseId, existing.courseId));
    console.log(`  keep ${opts.code} (id ${existing.courseId})`);
    return existing.courseId;
  }
  const [created] = await db
    .insert(courses)
    .values({
      courseCode: opts.code,
      courseName: opts.name,
      description: opts.description,
      durationWeeks: opts.durationWeeks,
      passingMark: 50,
      isActive: true,
    })
    .returning({ courseId: courses.courseId });
  console.log(`  created ${opts.code} (id ${created.courseId})`);
  return created.courseId;
}

async function moveIntakes(fromId: number, toId: number) {
  if (fromId === toId) return;
  const intakes = await db
    .select()
    .from(courseIntakes)
    .where(eq(courseIntakes.courseId, fromId));

  for (const intake of intakes) {
    const [clash] = await db
      .select()
      .from(courseIntakes)
      .where(
        and(
          eq(courseIntakes.courseId, toId),
          eq(courseIntakes.intakeNumber, intake.intakeNumber)
        )
      )
      .limit(1);

    if (clash) {
      // Keep target intake; rename source to avoid unique clash then skip merge of enrollments
      const newNumber = `${intake.intakeNumber}-m${intake.intakeId}`;
      await db
        .update(courseIntakes)
        .set({ courseId: toId, intakeNumber: newNumber.slice(0, 30) })
        .where(eq(courseIntakes.intakeId, intake.intakeId));
      console.log(
        `    moved intake ${intake.intakeNumber} → ${newNumber} under course ${toId}`
      );
    } else {
      await db
        .update(courseIntakes)
        .set({ courseId: toId })
        .where(eq(courseIntakes.intakeId, intake.intakeId));
      console.log(`    moved intake ${intake.intakeNumber} → course ${toId}`);
    }
  }
}

async function reassignCourseRefs(fromId: number, toId: number) {
  if (fromId === toId) return;
  await db
    .update(courseSubjects)
    .set({ courseId: toId })
    .where(eq(courseSubjects.courseId, fromId));
  await db
    .update(courseNotices)
    .set({ courseId: toId })
    .where(eq(courseNotices.courseId, fromId));
  await db
    .update(courseExercises)
    .set({ courseId: toId })
    .where(eq(courseExercises.courseId, fromId));
  await db
    .update(users)
    .set({ assignedCourseId: toId })
    .where(eq(users.assignedCourseId, fromId));

  // Drop prerequisite rows that would duplicate or self-reference after merge
  await db
    .delete(coursePrerequisites)
    .where(
      sql`(${coursePrerequisites.courseId} = ${fromId} OR ${coursePrerequisites.prerequisiteCourseId} = ${fromId})`
    );
}

async function deactivateCourse(id: number, reason: string) {
  await db
    .update(courses)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(courses.courseId, id));
  console.log(`  deactivated course ${id} (${reason})`);
}

async function mergeInto(
  keepCode: string,
  keepName: string,
  aliases: string[]
) {
  console.log(`\nMerge → ${keepCode}`);
  const keepId = await ensureCourse({
    code: keepCode,
    name: keepName,
    durationWeeks: 24,
    description: `${keepName}.`,
  });

  for (const alias of aliases) {
    if (alias === keepCode) continue;
    const [row] = await db
      .select()
      .from(courses)
      .where(eq(courses.courseCode, alias))
      .limit(1);
    if (!row) {
      console.log(`  skip missing alias ${alias}`);
      continue;
    }
    console.log(`  merging ${alias} (id ${row.courseId}) into ${keepCode}`);
    await moveIntakes(row.courseId, keepId);
    await reassignCourseRefs(row.courseId, keepId);
    await deactivateCourse(row.courseId, `merged into ${keepCode}`);
  }

  // Also rename any leftover keep if it was created under old code first
  await db
    .update(courses)
    .set({
      courseCode: keepCode,
      courseName: keepName,
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(courses.courseId, keepId));
}

async function main() {
  // FAOC: one folder only
  await mergeInto("FAOC", "Field Artillery Officers Course", [
    "FAOC",
    "FAOC1",
    "FAOAC",
  ]);

  // ROGC: include mistyped RO0G2025 / ROOG25
  await mergeInto("ROGC", "Regimental Officers Gunnery Course", [
    "ROGC",
    "ROG",
    "RO0G2025",
    "ROOG25",
    "ROOG2025",
  ]);

  console.log("\nEnsure technician levels");
  await ensureCourse({
    code: "AAT-L1",
    name: "Artillery Armament Technician Level 1",
    durationWeeks: 16,
    description: "Artillery Armament Technician Level 1.",
  });
  await ensureCourse({
    code: "GT-L1",
    name: "Gun Tractor Level 1",
    durationWeeks: 12,
    description: "Gun Tractor Level 1.",
  });

  // Hide empty seed demo courses that clutter folders (optional safety)
  const leftovers = await db
    .select({ id: courses.courseId, code: courses.courseCode })
    .from(courses)
    .where(and(eq(courses.isActive, true), ne(courses.courseCode, "")));

  console.log("\nActive courses now:");
  for (const c of leftovers) console.log(`  ${c.code} (id ${c.id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
