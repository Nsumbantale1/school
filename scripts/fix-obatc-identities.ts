/**
 * Fix OBATC 02/18-19 enrollments where bcc6 "OBATC 19" used wrong army numbers.
 * Marks stay with the person named on the OBATC sheet; enrollment is moved to
 * that person's correct army number (from OBGC 18 / known roster).
 *
 * Usage (from school/):
 *   npx tsx scripts/fix-obatc-identities.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { and, eq, sql } from "drizzle-orm";
import { db } from "../lib/db";
import {
  students,
  enrollments,
  results,
  courses,
  courseIntakes,
} from "../lib/db/schema";

function normArmy(a: string) {
  return a.toUpperCase().replace(/\s+/g, " ").trim();
}

/** Sheet army (as currently on OBATC enrollment) -> correct army for the named person */
const MOVES: Array<{
  fromArmy: string;
  toArmy: string;
  sourceName: string;
}> = [
  { fromArmy: "P 13197", toArmy: "P 13278", sourceName: "ER KIDANKA" },
  { fromArmy: "P 13402", toArmy: "P 12792", sourceName: "LA VALENTIN" },
  { fromArmy: "P 13153", toArmy: "P 13244", sourceName: "DM BUSATU" },
  { fromArmy: "P 13252", toArmy: "P 13197", sourceName: "GH MOSHALIPO" },
  { fromArmy: "P 13332", toArmy: "P 13280", sourceName: "JK JOSEPH" },
  { fromArmy: "P 13278", toArmy: "P 12786", sourceName: "GG NYONI" },
  { fromArmy: "P 13270", toArmy: "P 13416", sourceName: "GL MANYA" },
  { fromArmy: "P 13309", toArmy: "P 13232", sourceName: "IA CHANGUVU" },
];

async function findStudent(army: string) {
  const n = normArmy(army);
  const [exact] = await db
    .select()
    .from(students)
    .where(eq(students.armyNumber, n))
    .limit(1);
  if (exact) return exact;
  const [loose] = await db
    .select()
    .from(students)
    .where(
      sql`replace(upper(${students.armyNumber}), ' ', '') = ${n.replace(/\s+/g, "")}`
    )
    .limit(1);
  return loose ?? null;
}

async function main() {
  const [intake] = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(courses.courseCode, "OBATC"))
    .limit(1);

  if (!intake) {
    throw new Error("OBATC intake not found");
  }
  console.log(`OBATC intake ${intake.intakeNumber} id=${intake.intakeId}`);

  // Resolve actual from-army keys present in DB (spacing variants)
  const current = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      army: enrollments.studentArmyNumber,
      name: students.fullName,
      avg: enrollments.averageMarks,
      grade: enrollments.grade,
      rank: enrollments.rankAtEnrollment,
      unit: enrollments.unitAtEnrollment,
      status: enrollments.status,
      totalMarks: enrollments.totalMarks,
      position: enrollments.position,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .where(eq(enrollments.intakeId, intake.intakeId));

  const byCompact = new Map(
    current.map((e) => [normArmy(e.army).replace(/\s+/g, ""), e])
  );

  // Process moves in order that avoids stomping intermediate targets:
  // First move rows whose `to` is not a `from` of another pending move,
  // repeat until done (topological-ish).
  const pending = [...MOVES];
  const done: string[] = [];

  while (pending.length > 0) {
    const fromSet = new Set(
      pending.map((m) => normArmy(m.fromArmy).replace(/\s+/g, ""))
    );
    const idx = pending.findIndex(
      (m) => !fromSet.has(normArmy(m.toArmy).replace(/\s+/g, ""))
    );
    const move = idx >= 0 ? pending.splice(idx, 1)[0] : pending.shift()!;

    const fromKey = normArmy(move.fromArmy).replace(/\s+/g, "");
    const toKey = normArmy(move.toArmy).replace(/\s+/g, "");
    const sourceEnr = byCompact.get(fromKey);
    if (!sourceEnr) {
      console.log(`SKIP ${move.fromArmy} -> ${move.toArmy}: no OBATC enrollment on from-army`);
      continue;
    }

    const targetStudent = await findStudent(move.toArmy);
    if (!targetStudent) {
      console.log(`SKIP ${move.fromArmy} -> ${move.toArmy}: target student missing`);
      continue;
    }

    const existingTarget = byCompact.get(toKey);

    console.log(
      `MOVE enr=${sourceEnr.enrollmentId} ${sourceEnr.army} (${sourceEnr.name}) ` +
        `"${move.sourceName}" -> ${targetStudent.armyNumber} (${targetStudent.fullName})`
    );

    // If target already has an OBATC enrollment, remove it (it holds wrong person's marks
    // that will be / were moved elsewhere, or is a duplicate).
    if (existingTarget && existingTarget.enrollmentId !== sourceEnr.enrollmentId) {
      console.log(
        `  delete conflicting target enr=${existingTarget.enrollmentId} (${existingTarget.army} ${existingTarget.name})`
      );
      await db
        .delete(enrollments)
        .where(eq(enrollments.enrollmentId, existingTarget.enrollmentId));
      byCompact.delete(toKey);
    }

    // Re-point source enrollment to the correct student
    await db
      .update(enrollments)
      .set({
        studentArmyNumber: targetStudent.armyNumber,
        rankAtEnrollment: sourceEnr.rank || targetStudent.rank,
        unitAtEnrollment: sourceEnr.unit || targetStudent.unit,
        updatedAt: new Date(),
      })
      .where(eq(enrollments.enrollmentId, sourceEnr.enrollmentId));

    byCompact.delete(fromKey);
    byCompact.set(toKey, {
      ...sourceEnr,
      army: targetStudent.armyNumber,
      name: targetStudent.fullName,
    });
    done.push(`${move.fromArmy}->${move.toArmy}`);
  }

  // EM LIOGA: listed as P 13176 on OBATC but that army is JE MWAISABULA on OBGC.
  const liogaKey = "P13176";
  const liogaEnr = byCompact.get(liogaKey);
  if (liogaEnr && /MWAISABULA/i.test(liogaEnr.name)) {
    const liogaArmy = "P 13176L";
    let liogaStudent = await findStudent(liogaArmy);
    if (!liogaStudent) {
      await db.insert(students).values({
        armyNumber: liogaArmy,
        fullName: "EM LIOGA",
        rank: "Lt",
        gender: "male",
        unit: "SOFA",
        notes:
          "Army number uncertain. OBATC 19 listed P 13176 which belongs to JE MWAISABULA on OBGC 18. Verify and merge when correct army is known.",
        isActive: true,
      });
      liogaStudent = await findStudent(liogaArmy);
      console.log(`Created student ${liogaArmy} EM LIOGA`);
    }
    if (liogaStudent) {
      await db
        .update(enrollments)
        .set({
          studentArmyNumber: liogaStudent.armyNumber,
          rankAtEnrollment: "Lt",
          unitAtEnrollment: "SOFA",
          updatedAt: new Date(),
        })
        .where(eq(enrollments.enrollmentId, liogaEnr.enrollmentId));
      console.log(
        `MOVE enr=${liogaEnr.enrollmentId} P 13176 (JE MWAISABULA) "EM LIOGA" -> ${liogaStudent.armyNumber}`
      );
      done.push("P 13176->P 13176L (EM LIOGA)");
    }
  }

  // Final roster
  const finalRoster = await db
    .select({
      army: enrollments.studentArmyNumber,
      name: students.fullName,
      avg: enrollments.averageMarks,
      grade: enrollments.grade,
      status: enrollments.status,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .where(eq(enrollments.intakeId, intake.intakeId))
    .orderBy(students.fullName);

  console.log(`\nDone. Moves applied: ${done.length}`);
  console.log(`OBATC roster now: ${finalRoster.length} students`);
  for (const r of finalRoster) {
    console.log(
      `  ${r.army}\t${r.name}\t${r.avg ?? "-"}\t${r.grade ?? "-"}\t${r.status}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
