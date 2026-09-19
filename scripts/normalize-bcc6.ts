/**
 * Normalize bcc6-imported intakes + subjects under the correct courses:
 * - Intake numbers → SOFA style (16/16, 03/19, 05/19-20)
 * - Subject abbreviations → full names aligned with each course
 * - Merge duplicate course_subjects / results after rename
 *
 * Usage: npx tsx scripts/normalize-bcc6.ts
 */

import "dotenv/config";
import { config } from "dotenv";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../lib/db";
import {
  courses,
  courseIntakes,
  courseSubjects,
  enrollments,
  results,
} from "../lib/db/schema";
import { formatIntakeLabel } from "../lib/utils/intake-label";

config({ path: ".env.local" });

/** Abbreviation / variant → canonical subject name */
const SUBJECT_CANON: Record<string, string> = {
  DGE: "Duties at the Gun End (DGE)",
  DOP: "Duties at the Observation Post (DOP)",
  FD: "Fire Discipline (FD)",
  EQPT: "Equipment (EQPT)",
  EPT: "Equipment (EQPT)",
  AMMO: "Ammunition (AMMO)",
  GD: "Gun Drill (GD)",
  GM: "Gunnery Mathematics (GM)",
  BLST: "Ballistics (BLST)",
  BALISTIC: "Ballistics (BLST)",
  BALLST: "Ballistics (BLST)",
  BALISTICS: "Ballistics (BLST)",
  AI: "Artillery Instruments (AI)",
  MRS: "Map Reading and Survey (MRS)",
  SVY: "Map Reading and Survey (MRS)",
  MU: "Map Using (MU)",
  ICB: "Intelligence & Counter Bombardment (I&CB)",
  "I&CB": "Intelligence & Counter Bombardment (I&CB)",
  "IS&C": "Intelligence & Counter Bombardment (I&CB)",
  "IS&COIN": "Internal Security & Counter Insurgency (IS&COIN)",
  "IS&CI": "Internal Security & Counter Insurgency (IS&COIN)",
  AFCS: "Artillery Fire Control System (AFCS)",
  AFC: "Artillery Fire Control System (AFCS)",
  AFCI: "Artillery Fire Control System (AFCS)",
  TAC: "Tactics (TAC)",
  TACTICS: "Tactics (TAC)",
  MOI: "Method of Instruction (MOI)",
  AFOP: "Artillery Fire Order Procedure (AFOP)",
  SP: "Safety Procedures (SP)",
  HA: "Home Assignment (HA)",
  HW: "Home Work (HW)",
  WT: "Weekly Test (WT)",
  WK: "Weekly Test (WT)",
  MT: "Monthly Test (MT)",
  "M\\T": "Monthly Test (MT)",
  PT: "Physical Training (PT)",
  ADM: "Administration (ADM)",
  MI: "Military Intelligence (MI)",
  PK: "Protocol & Ethics (PK)",
  PKO: "Protocol & Ethics (PK)",
  IS: "Internal Security (IS)",
  CIVS: "Civics (CIV)",
  CIVCS: "Civics (CIV)",
  CIVIC: "Civics (CIV)",
  CIV: "Civics (CIV)",
  CVCS: "Civics (CIV)",
  LT: "Leadership Training (LT)",
  ML: "Military Law (ML)",
  "M&L": "Military Law (ML)",
  TM: "Training Management (TM)",
  SDM: "Staff Duties & Military Writing (SD&MW)",
  "SD&MW": "Staff Duties & Military Writing (SD&MW)",
  "SD/MW": "Staff Duties & Military Writing (SD&MW)",
  "SD\\MW": "Staff Duties & Military Writing (SD&MW)",
  SD: "Staff Duties & Military Writing (SD&MW)",
  SDML: "Staff Duties & Military Writing (SD&MW)",
  COM: "Communication (COM)",
  COMM: "Communication (COM)",
  FE: "Field Exercise (FE)",
  CC: "Course Critique (CC)",
  RM: "Range Management (RM)",
  "A&O": "Administration & Organization (A&O)",
  "AI&O": "Administration & Organization (A&O)",
  // FAOC
  GT: "Gunnery Training (GT)",
  POJO: "Principles of Joint Operations (POJO)",
  FS: "Fire Support (FS)",
  FA: "Field Artillery (FA)",
  CP: "Class Participation (CP)",
  // RSOC
  BSM: "Basic Survey Mathematics (BSM)",
  SI: "Survey Instruments (SI)",
  ST: "Survey Theory (ST)",
  SC: "Survey Computation (SC)",
  SM: "Survey Methods (SM)",
  FR: "Field Recce (FR)",
  ASTR: "Astronomy (ASTR)",
  ACTR: "Astronomy (ASTR)",
  CRS: "Conduct of Regimental Survey (CRS)",
  CRC: "Conduct of Regimental Survey (CRS)",
  // OBGC extras
  "A&D": "Artillery Deployment (A&D)",
  AFUS: "Artillery Fire Units (AFUS)",
  GV: "Gunner's Vocabulary (GV)",
  // BCC extras
  IA: "Instrument Adjustment (IA)",
  // OBATC
  AG: "Artillery Gunnery (AG)",
  WRM: "Weapon Repair & Maintenance (WRM)",
  SSA: "Small Arms (SSA)",
  TD: "Technical Drawing (TD)",
  CALB: "Calibration (CALB)",
  MMI: "Maintenance Management (MMI)",
  RECOV: "Recovery (RECOV)",
  "BD&M": "Breakdown & Maintenance (BD&M)",
  EM: "Equipment Maintenance (EM)",
  "RM&T": "Repair Methods & Tools (RM&T)",
};

function canonSubject(name: string): string {
  const raw = name.replace(/\s+/g, " ").trim();
  const upper = raw.toUpperCase();
  if (SUBJECT_CANON[upper]) return SUBJECT_CANON[upper];
  // already "Full Name (CODE)"
  const m = raw.match(/\(([A-Z0-9&/\\-]+)\)$/i);
  if (m) {
    const code = m[1].toUpperCase().replace(/\\/g, "/");
    if (SUBJECT_CANON[code]) return SUBJECT_CANON[code];
  }
  // WT (2) style duplicates from header
  const dup = upper.match(/^(.+?)\s+\((\d+)\)$/);
  if (dup && SUBJECT_CANON[dup[1]]) {
    return `${SUBJECT_CANON[dup[1]]} (${dup[2]})`;
  }
  return raw;
}

async function normalizeIntakes() {
  const bcc6EnrollmentIds = await db.execute(sql`
    select distinct e.intake_id as intake_id
    from results r
    join enrollments e on e.enrollment_id = r.enrollment_id
    where r.remarks like 'bcc6:%'
  `);

  const intakeIds = bcc6EnrollmentIds.rows.map(
    (r) => Number((r as { intake_id: number }).intake_id)
  );
  if (!intakeIds.length) {
    console.log("No bcc6 intakes found.");
    return;
  }

  const intakes = await db
    .select()
    .from(courseIntakes)
    .where(inArray(courseIntakes.intakeId, intakeIds));

  for (const intake of intakes) {
    const label = formatIntakeLabel({
      intakeNumber: intake.intakeNumber,
      startDate: intake.startDate,
      endDate: intake.endDate,
      year: intake.year,
    });
    // Prefer slash form as stored intake_number for consistency
    if (intake.intakeNumber === label) continue;

    // Avoid unique (course_id, intake_number) clash
    const [clash] = await db
      .select({ intakeId: courseIntakes.intakeId })
      .from(courseIntakes)
      .where(
        and(
          eq(courseIntakes.courseId, intake.courseId),
          eq(courseIntakes.intakeNumber, label)
        )
      )
      .limit(1);

    if (clash && clash.intakeId !== intake.intakeId) {
      console.warn(
        `Skip rename ${intake.intakeNumber} → ${label} (already exists id ${clash.intakeId})`
      );
      continue;
    }

    await db
      .update(courseIntakes)
      .set({ intakeNumber: label, updatedAt: new Date() })
      .where(eq(courseIntakes.intakeId, intake.intakeId));
    console.log(`  Intake ${intake.intakeId}: ${intake.intakeNumber} → ${label}`);
  }

  // Fix OBATC missing dates if still broken
  const [obATC] = await db
    .select({ courseId: courses.courseId })
    .from(courses)
    .where(eq(courses.courseCode, "OBATC"))
    .limit(1);
  if (obATC) {
    await db
      .update(courseIntakes)
      .set({
        startDate: "2018-08-14",
        endDate: "2019-03-28",
        year: 2019,
        intakeNumber: "02/18-19",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(courseIntakes.courseId, obATC.courseId),
          inArray(courseIntakes.intakeNumber, ["02-18-20", "02/18-20", "02/20"])
        )
      );
  }
}

async function normalizeResultSubjects() {
  const rows = await db.execute(sql`
    select result_id, enrollment_id, subject_name, marks_obtained, max_marks, grade, remarks
    from results
    where remarks like 'bcc6:%'
  `);

  type Row = {
    result_id: number;
    enrollment_id: number;
    subject_name: string;
    marks_obtained: string;
    max_marks: string;
    grade: string | null;
    remarks: string | null;
  };

  const byEnrollment = new Map<number, Row[]>();
  for (const raw of rows.rows as Row[]) {
    const list = byEnrollment.get(raw.enrollment_id) ?? [];
    list.push(raw);
    byEnrollment.set(raw.enrollment_id, list);
  }

  let updated = 0;
  let merged = 0;
  let deleted = 0;

  for (const [enrollmentId, list] of byEnrollment) {
    const keep = new Map<string, Row>();
    const toDelete: number[] = [];

    for (const row of list) {
      const canon = canonSubject(row.subject_name);
      const existing = keep.get(canon);
      if (!existing) {
        keep.set(canon, { ...row, subject_name: canon });
        continue;
      }
      // Prefer higher marks if duplicate after canonicalize
      const a = Number(existing.marks_obtained);
      const b = Number(row.marks_obtained);
      if (b > a) {
        toDelete.push(existing.result_id);
        keep.set(canon, { ...row, subject_name: canon });
      } else {
        toDelete.push(row.result_id);
      }
      merged += 1;
    }

    if (toDelete.length) {
      await db.delete(results).where(inArray(results.resultId, toDelete));
      deleted += toDelete.length;
    }

    for (const row of keep.values()) {
      const original = list.find((r) => r.result_id === row.result_id);
      if (!original) continue;
      if (original.subject_name === row.subject_name) continue;
      // Check clash with another result already named canon
      const [clash] = await db
        .select({ resultId: results.resultId })
        .from(results)
        .where(
          and(
            eq(results.enrollmentId, enrollmentId),
            eq(results.subjectName, row.subject_name)
          )
        )
        .limit(1);
      if (clash && clash.resultId !== row.result_id) {
        await db.delete(results).where(eq(results.resultId, row.result_id));
        deleted += 1;
        continue;
      }
      await db
        .update(results)
        .set({
          subjectName: row.subject_name,
          updatedAt: new Date(),
        })
        .where(eq(results.resultId, row.result_id));
      updated += 1;
    }
  }

  console.log(
    `  Results: renamed ${updated}, merged ${merged}, deleted ${deleted}`
  );
}

async function normalizeCourseSubjects() {
  const courseCodes = ["BCC", "FAOC", "OBGC", "ROGC", "RSOC", "OBATC"];
  const courseRows = await db
    .select()
    .from(courses)
    .where(inArray(courses.courseCode, courseCodes));

  for (const course of courseRows) {
    const subjects = await db
      .select()
      .from(courseSubjects)
      .where(eq(courseSubjects.courseId, course.courseId));

    const keep = new Map<
      string,
      { subjectId: number; maxMarks: string; sortOrder: number }
    >();
    const toDelete: number[] = [];

    for (const s of subjects) {
      const canon = canonSubject(s.subjectName);
      const existing = keep.get(canon);
      if (!existing) {
        keep.set(canon, {
          subjectId: s.subjectId,
          maxMarks: String(s.maxMarks),
          sortOrder: s.sortOrder,
        });
        if (s.subjectName !== canon) {
          await db
            .update(courseSubjects)
            .set({ subjectName: canon })
            .where(eq(courseSubjects.subjectId, s.subjectId));
        }
        continue;
      }
      // merge: keep lower sortOrder / higher maxMarks
      toDelete.push(s.subjectId);
      const maxMarks = Math.max(
        Number(existing.maxMarks),
        Number(s.maxMarks)
      );
      keep.set(canon, {
        ...existing,
        maxMarks: String(maxMarks),
        sortOrder: Math.min(existing.sortOrder, s.sortOrder),
      });
    }

    if (toDelete.length) {
      await db
        .delete(courseSubjects)
        .where(inArray(courseSubjects.subjectId, toDelete));
    }

    let order = 0;
    for (const [name, meta] of keep) {
      await db
        .update(courseSubjects)
        .set({
          subjectName: name,
          maxMarks: meta.maxMarks,
          sortOrder: order++,
        })
        .where(eq(courseSubjects.subjectId, meta.subjectId));
    }

    console.log(
      `  ${course.courseCode}: ${subjects.length} → ${keep.size} subjects`
    );
  }
}

async function printSummary() {
  const rows = await db.execute(sql`
    select c.course_code,
           ci.intake_number,
           ci.year,
           count(distinct e.enrollment_id)::int as students
    from results r
    join enrollments e on e.enrollment_id = r.enrollment_id
    join course_intakes ci on ci.intake_id = e.intake_id
    join courses c on c.course_id = ci.course_id
    where r.remarks like 'bcc6:%'
    group by c.course_code, ci.intake_number, ci.year
    order by c.course_code, ci.year, ci.intake_number
  `);
  console.log("\n======= BY COURSE =======");
  for (const r of rows.rows) {
    console.log(
      `  ${(r as { course_code: string }).course_code.padEnd(6)} INT ${(r as { intake_number: string }).intake_number.padEnd(12)} ${(r as { students: number }).students} students`
    );
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  console.log("1) Normalize intakes…");
  await normalizeIntakes();
  console.log("2) Normalize result subjects…");
  await normalizeResultSubjects();
  console.log("3) Normalize course subjects…");
  await normalizeCourseSubjects();
  await printSummary();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
