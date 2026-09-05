/**
 * Import Battery Commander Course INT 15-26 from the official Excel workbook.
 *
 * Usage (from school/):
 *   npx tsx scripts/import-bcc.ts
 */

import "dotenv/config";
import { config } from "dotenv";
import path from "path";
import * as XLSX from "xlsx";
import { eq, and } from "drizzle-orm";
import { db } from "../lib/db";
import {
  courses,
  courseIntakes,
  courseSubjects,
  students,
  enrollments,
  results,
} from "../lib/db/schema";
import { calculateGrade } from "../lib/utils/grades";
import {
  encodeBccRemarks,
  tpdfGradeToSystem,
  type BccResultMeta,
} from "../lib/utils/bcc-report";
import { recalculatePositions } from "../lib/utils/positions";

config({ path: ".env.local" });

const WORKBOOK =
  process.argv[2] ||
  path.join(
    process.env.HOME ?? "",
    "Desktop/CV-2/BCC INT 15-26.xlsx"
  );

function cell(row: unknown[] | undefined, index: number): unknown {
  return row?.[index];
}

function asText(value: unknown): string {
  return String(value ?? "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseFloat(String(value).replace(/[%+,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function titleRank(raw: string): string {
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) return compact;
  return compact
    .split(" ")
    .map((part) => {
      if (part.startsWith("(") && part.endsWith(")")) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function isOfficerSheet(name: string): boolean {
  return /^.+\s\(\d+\)$/.test(name.trim());
}

type OfficerRow = {
  armyNumber: string;
  rank: string;
  fullName: string;
  unit: string;
  overall: number;
  grade: string;
  remarks: string;
  theory: Array<{
    name: string;
    theory: number | null;
    practical: number | null;
    total: number;
    weight: number;
    marks: number;
  }>;
  field: Array<{
    name: string;
    score: number;
    weight: number;
    marks: number;
  }>;
};

function parseOfficerSheet(name: string, sheet: XLSX.WorkSheet): OfficerRow | null {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  const identity = rows[12] ?? [];
  const armyNumber = asText(cell(identity, 0));
  const rank = titleRank(asText(cell(identity, 3)));
  const fullName = asText(cell(identity, 4));
  const unit = asText(cell(identity, 7));
  if (!armyNumber || !fullName) {
    console.warn(`Skip ${name}: missing identity`);
    return null;
  }

  const theory: OfficerRow["theory"] = [];
  for (let i = 19; i <= 36; i++) {
    const row = rows[i] ?? [];
    const subject = asText(cell(row, 0));
    if (!subject || subject.toUpperCase().startsWith("TOTAL")) continue;
    const total = asNumber(cell(row, 7));
    const weight = asNumber(cell(row, 8));
    const marks = asNumber(cell(row, 9));
    if (total == null || weight == null || marks == null) continue;
    theory.push({
      name: subject,
      theory: asNumber(cell(row, 5)),
      practical: asNumber(cell(row, 6)),
      total,
      weight,
      marks,
    });
  }

  const field: OfficerRow["field"] = [];
  for (let i = 40; i <= 48; i++) {
    const row = rows[i] ?? [];
    const exercise = asText(cell(row, 0));
    if (!exercise || exercise.toUpperCase().startsWith("TOTAL")) continue;
    const score = asNumber(cell(row, 5));
    const weight = asNumber(cell(row, 6));
    const marks = asNumber(cell(row, 8));
    if (score == null || weight == null || marks == null) continue;
    field.push({
      name: exercise,
      score,
      weight,
      marks,
    });
  }

  const overall =
    asNumber(cell(rows[53], 7)) ??
    asNumber(cell(rows[49], 8)) ??
    theory.reduce((s, r) => s + r.marks, 0) +
      field.reduce((s, r) => s + r.marks, 0);

  return {
    armyNumber,
    rank: rank || "Lt",
    fullName,
    unit,
    overall,
    grade: asText(cell(rows[54], 7)) || "C",
    remarks: asText(cell(rows[55], 7)) || "Good",
    theory,
    field,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing. Check .env.local");
    process.exit(1);
  }

  console.log("Workbook:", WORKBOOK);
  const workbook = XLSX.readFile(WORKBOOK, { cellDates: true });
  const officers: OfficerRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    if (!isOfficerSheet(sheetName)) continue;
    const parsed = parseOfficerSheet(sheetName, workbook.Sheets[sheetName]);
    if (parsed) officers.push(parsed);
  }

  if (officers.length === 0) {
    console.error("No officer sheets found.");
    process.exit(1);
  }

  console.log(`Parsed ${officers.length} officer reports`);

  const [existingCourse] = await db
    .select()
    .from(courses)
    .where(eq(courses.courseCode, "BCC"))
    .limit(1);

  let courseId = existingCourse?.courseId;
  if (!courseId) {
    const [created] = await db
      .insert(courses)
      .values({
        courseCode: "BCC",
        courseName: "Battery Commander Course",
        description:
          "Battery Commander Course (BCC). Final mark = Theory & Practical 40% + Field Exercises 60%.",
        durationWeeks: 16,
        passingMark: 50,
        isActive: true,
      })
      .returning({ courseId: courses.courseId });
    courseId = created.courseId;
    console.log("Created course BCC id", courseId);
  } else {
    await db
      .update(courses)
      .set({
        courseName: "Battery Commander Course",
        isActive: true,
        durationWeeks: 16,
        updatedAt: new Date(),
      })
      .where(eq(courses.courseId, courseId));
    console.log("Using existing course BCC id", courseId);
  }

  const subjectCatalog = new Map<string, number>();
  for (const officer of officers) {
    for (const row of officer.theory) {
      if (!subjectCatalog.has(row.name)) subjectCatalog.set(row.name, row.weight);
    }
    for (const row of officer.field) {
      if (!subjectCatalog.has(row.name)) subjectCatalog.set(row.name, row.weight);
    }
  }

  let sortOrder = 0;
  for (const [subjectName, weight] of subjectCatalog) {
    const [existing] = await db
      .select({ subjectId: courseSubjects.subjectId })
      .from(courseSubjects)
      .where(
        and(
          eq(courseSubjects.courseId, courseId),
          eq(courseSubjects.subjectName, subjectName)
        )
      )
      .limit(1);
    if (existing) {
      await db
        .update(courseSubjects)
        .set({ maxMarks: String(weight), sortOrder })
        .where(eq(courseSubjects.subjectId, existing.subjectId));
    } else {
      await db.insert(courseSubjects).values({
        courseId,
        subjectName,
        maxMarks: String(weight),
        sortOrder,
      });
    }
    sortOrder += 1;
  }

  const [existingIntake] = await db
    .select()
    .from(courseIntakes)
    .where(
      and(
        eq(courseIntakes.courseId, courseId),
        eq(courseIntakes.intakeNumber, "15-26")
      )
    )
    .limit(1);

  let intakeId = existingIntake?.intakeId;
  if (!intakeId) {
    const [created] = await db
      .insert(courseIntakes)
      .values({
        courseId,
        intakeNumber: "15-26",
        year: 2026,
        startDate: "2026-01-13",
        endDate: "2026-04-30",
        isActive: true,
      })
      .returning({ intakeId: courseIntakes.intakeId });
    intakeId = created.intakeId;
    console.log("Created intake 15-26 id", intakeId);
  } else {
    await db
      .update(courseIntakes)
      .set({
        year: 2026,
        startDate: "2026-01-13",
        endDate: "2026-04-30",
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(courseIntakes.intakeId, intakeId));
    console.log("Using existing intake 15-26 id", intakeId);
  }

  for (const officer of officers) {
    const [existingStudent] = await db
      .select({ armyNumber: students.armyNumber })
      .from(students)
      .where(eq(students.armyNumber, officer.armyNumber))
      .limit(1);

    if (existingStudent) {
      await db
        .update(students)
        .set({
          fullName: officer.fullName,
          rank: officer.rank,
          unit: officer.unit || null,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(students.armyNumber, officer.armyNumber));
    } else {
      await db.insert(students).values({
        armyNumber: officer.armyNumber,
        fullName: officer.fullName,
        rank: officer.rank,
        gender: "male",
        unit: officer.unit || null,
        isActive: true,
      });
    }

    const [existingEnrollment] = await db
      .select({ enrollmentId: enrollments.enrollmentId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentArmyNumber, officer.armyNumber),
          eq(enrollments.intakeId, intakeId)
        )
      )
      .limit(1);

    let enrollmentId = existingEnrollment?.enrollmentId;
    const systemGrade = tpdfGradeToSystem(officer.grade);
    if (!enrollmentId) {
      const [created] = await db
        .insert(enrollments)
        .values({
          studentArmyNumber: officer.armyNumber,
          intakeId,
          rankAtEnrollment: officer.rank,
          unitAtEnrollment: officer.unit || null,
          status: "completed",
          totalMarks: officer.overall.toFixed(2),
          averageMarks: officer.overall.toFixed(2),
          grade: systemGrade,
        })
        .returning({ enrollmentId: enrollments.enrollmentId });
      enrollmentId = created.enrollmentId;
    } else {
      await db
        .update(enrollments)
        .set({
          rankAtEnrollment: officer.rank,
          unitAtEnrollment: officer.unit || null,
          status: "completed",
          totalMarks: officer.overall.toFixed(2),
          averageMarks: officer.overall.toFixed(2),
          grade: systemGrade,
          updatedAt: new Date(),
        })
        .where(eq(enrollments.enrollmentId, enrollmentId));
    }

    if (enrollmentId == null) {
      throw new Error(`Missing enrollment for ${officer.armyNumber}`);
    }

    await db.delete(results).where(eq(results.enrollmentId, enrollmentId));

    const resultRows = [
      ...officer.theory.map((row) => {
        const meta: BccResultMeta = {
          section: "theory",
          theory: row.theory,
          practical: row.practical,
          total: row.total,
          weight: row.weight,
          courseGrade: officer.grade,
          courseRemarks: officer.remarks,
        };
        return {
          enrollmentId,
          subjectName: row.name,
          marksObtained: row.marks.toFixed(2),
          maxMarks: row.weight.toFixed(2),
          grade: calculateGrade(row.total, 100),
          remarks: encodeBccRemarks(meta),
        };
      }),
      ...officer.field.map((row) => {
        const meta: BccResultMeta = {
          section: "field",
          theory: null,
          practical: null,
          total: row.score,
          weight: row.weight,
          courseGrade: officer.grade,
          courseRemarks: officer.remarks,
        };
        return {
          enrollmentId,
          subjectName: row.name,
          marksObtained: row.marks.toFixed(2),
          maxMarks: row.weight.toFixed(2),
          grade: calculateGrade(row.score, 100),
          remarks: encodeBccRemarks(meta),
        };
      }),
    ];

    if (resultRows.length > 0) {
      await db.insert(results).values(resultRows);
    }

    console.log(
      `  ${officer.armyNumber} ${officer.rank} ${officer.fullName}  ${officer.overall.toFixed(2)}%  ${officer.grade}`
    );
  }

  await recalculatePositions(intakeId);
  console.log(`Imported ${officers.length} BCC INT 15-26 officers.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
