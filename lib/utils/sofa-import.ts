import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  courses,
  courseIntakes,
  courseSubjects,
  students,
  enrollments,
  results,
} from "../db/schema";
import { rankPositionsFromStoredAverages } from "./positions";
import { tpdfGradeToSystem } from "./bcc-report";
import { DEFAULT_PASSING_MARK } from "./passing-mark";
import { academicStatusFromAverage } from "./enrollment-status";
import {
  parseSofaWorkbookAll,
  sofaResultRows,
  type ParsedSofaWorkbook,
} from "./sofa-excel";

export type SofaImportSummary = {
  filename: string;
  courseCode: string;
  courseName: string;
  intakeNumber: string;
  students: number;
  results: number;
  skippedSheets: number;
  warnings: string[];
  courseId: number;
  intakeId: number;
};

/** Battery streams (P/Q/R/T) of one intake are stored as a single intake. */
export function intakeNumberWithoutStream(intakeNumber: string): string {
  return intakeNumber.trim().replace(/-[PQRT]$/i, "");
}

/** "P10130", "mt 128933'" → "P 10130", "MT 128933". Other formats are returned trimmed. */
export function normalizeArmyNumber(armyNumber: string): string {
  const cleaned = armyNumber.trim().replace(/['`]+$/g, "").trim();
  const m = cleaned.match(/^([A-Za-z]{1,3})\s*(\d+)$/);
  return m ? `${m[1].toUpperCase()} ${m[2]}` : cleaned;
}

export async function importParsedSofaWorkbook(
  input: ParsedSofaWorkbook,
  enteredBy?: number | null,
  options: { keepExistingStudentDetails?: boolean } = {}
): Promise<SofaImportSummary> {
  const parsed = {
    ...input,
    intakeNumber: intakeNumberWithoutStream(input.intakeNumber),
    students: input.students.map((s) => ({ ...s, armyNumber: normalizeArmyNumber(s.armyNumber) })),
  };
  const [existingCourse] = await db
    .select()
    .from(courses)
    .where(eq(courses.courseCode, parsed.courseCode))
    .limit(1);

  let courseId = existingCourse?.courseId;
  if (!courseId) {
    const [created] = await db
      .insert(courses)
      .values({
        courseCode: parsed.courseCode,
        courseName: parsed.courseName,
        description: `${parsed.courseName}. Imported from official SOFA workbook.`,
        durationWeeks: parsed.durationWeeks,
        passingMark: 55,
        isActive: true,
      })
      .returning({ courseId: courses.courseId });
    courseId = created.courseId;
  } else {
    await db
      .update(courses)
      .set({
        courseName: parsed.courseName,
        durationWeeks: parsed.durationWeeks,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(courses.courseId, courseId));
  }

  const subjectCatalog = new Map<string, number>();
  for (const student of parsed.students) {
    for (const row of student.theory) {
      if (!subjectCatalog.has(row.name)) subjectCatalog.set(row.name, row.weight);
    }
    for (const row of student.field) {
      const fieldName = subjectCatalog.has(row.name)
        ? `Field Ex — ${row.name}`
        : row.name;
      if (!subjectCatalog.has(fieldName)) subjectCatalog.set(fieldName, row.weight);
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
        eq(courseIntakes.intakeNumber, parsed.intakeNumber)
      )
    )
    .limit(1);

  let intakeId = existingIntake?.intakeId;
  if (!intakeId) {
    const [created] = await db
      .insert(courseIntakes)
      .values({
        courseId,
        intakeNumber: parsed.intakeNumber,
        year: parsed.year,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        isActive: true,
      })
      .returning({ intakeId: courseIntakes.intakeId });
    intakeId = created.intakeId;
  } else {
    await db
      .update(courseIntakes)
      .set({
        year: parsed.year,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(courseIntakes.intakeId, intakeId));
  }

  let resultCount = 0;

  for (const student of parsed.students) {
    const [existingStudent] = await db
      .select({ armyNumber: students.armyNumber })
      .from(students)
      .where(eq(students.armyNumber, student.armyNumber))
      .limit(1);

    if (existingStudent && options.keepExistingStudentDetails) {
      // Transcribed summaries carry short / misspelt names; keep the student record as is.
    } else if (existingStudent) {
      await db
        .update(students)
        .set({
          fullName: student.fullName,
          rank: student.rank,
          unit: student.unit || null,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(students.armyNumber, student.armyNumber));
    } else {
      await db.insert(students).values({
        armyNumber: student.armyNumber,
        fullName: student.fullName,
        rank: student.rank,
        gender: "male",
        unit: student.unit || null,
        isActive: true,
      });
    }

    const [existingEnrollment] = await db
      .select({ enrollmentId: enrollments.enrollmentId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentArmyNumber, student.armyNumber),
          eq(enrollments.intakeId, intakeId)
        )
      )
      .limit(1);

    const systemGrade = tpdfGradeToSystem(student.tpdfGrade);
    let enrollmentId = existingEnrollment?.enrollmentId;
    const status =
      academicStatusFromAverage(student.overall, DEFAULT_PASSING_MARK) ??
      "completed";

    if (!enrollmentId) {
      const [created] = await db
        .insert(enrollments)
        .values({
          studentArmyNumber: student.armyNumber,
          intakeId,
          rankAtEnrollment: student.rank,
          unitAtEnrollment: student.unit || null,
          status,
          ...(status === "incomplete" ? { ceasedAt: new Date() } : {}),
          totalMarks: student.overall.toFixed(2),
          averageMarks: student.overall.toFixed(2),
          grade: systemGrade,
        })
        .returning({ enrollmentId: enrollments.enrollmentId });
      enrollmentId = created.enrollmentId;
    } else {
      await db
        .update(enrollments)
        .set({
          rankAtEnrollment: student.rank,
          unitAtEnrollment: student.unit || null,
          status,
          ...(status === "incomplete" ? { ceasedAt: new Date() } : {}),
          totalMarks: student.overall.toFixed(2),
          averageMarks: student.overall.toFixed(2),
          grade: systemGrade,
          updatedAt: new Date(),
        })
        .where(eq(enrollments.enrollmentId, enrollmentId));
    }

    await db.delete(results).where(eq(results.enrollmentId, enrollmentId));

    const resultRows = sofaResultRows(student).map((row) => ({
      enrollmentId,
      ...row,
      enteredBy: enteredBy ?? null,
    }));

    if (resultRows.length > 0) {
      await db.insert(results).values(resultRows);
      resultCount += resultRows.length;
    }
  }

  // Excel TOTAL MARKS (%) is authoritative for SOFA workbooks. Do not recompute
  // averages from subject rows: the intake may also hold other streams' students.
  for (const student of parsed.students) {
    const overall = Math.min(100, student.overall);
    const systemGrade = tpdfGradeToSystem(student.tpdfGrade);
    const status =
      academicStatusFromAverage(overall, DEFAULT_PASSING_MARK) ?? "completed";
    await db
      .update(enrollments)
      .set({
        totalMarks: overall.toFixed(2),
        averageMarks: overall.toFixed(2),
        grade: systemGrade,
        status,
        ceasedAt: status === "incomplete" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(enrollments.intakeId, intakeId),
          eq(enrollments.studentArmyNumber, student.armyNumber)
        )
      );
  }

  await rankPositionsFromStoredAverages(intakeId);

  return {
    filename: parsed.filename,
    courseCode: parsed.courseCode,
    courseName: parsed.courseName,
    intakeNumber: parsed.intakeNumber,
    students: parsed.students.length,
    results: resultCount,
    skippedSheets: parsed.skippedSheets,
    warnings: parsed.warnings,
    courseId,
    intakeId,
  };
}

export async function importSofaWorkbookFromBuffer(
  buffer: Buffer | Uint8Array,
  filename: string,
  enteredBy?: number | null
): Promise<SofaImportSummary> {
  const parsedList = parseSofaWorkbookAll(buffer, filename);
  return importParsedSofaWorkbookList(parsedList, enteredBy);
}

export async function importSofaWorkbookFromPath(
  filePath: string,
  filename: string,
  enteredBy?: number | null
): Promise<SofaImportSummary> {
  const parsedList = parseSofaWorkbookAll(filePath, filename);
  return importParsedSofaWorkbookList(parsedList, enteredBy);
}

async function importParsedSofaWorkbookList(
  parsedList: ParsedSofaWorkbook[],
  enteredBy?: number | null
): Promise<SofaImportSummary> {
  if (parsedList.length === 0) {
    throw new Error("No parseable sheets found in workbook.");
  }

  let combined: SofaImportSummary | null = null;
  for (const parsed of parsedList) {
    const summary = await importParsedSofaWorkbook(parsed, enteredBy);
    if (!combined) {
      combined = { ...summary };
    } else {
      combined.students += summary.students;
      combined.results += summary.results;
      combined.skippedSheets += summary.skippedSheets;
      combined.warnings = [
        ...combined.warnings,
        ...summary.warnings,
        `Also imported ${summary.courseCode} intake ${summary.intakeNumber}.`,
      ];
      // Keep last intake as primary navigation target
      combined.courseId = summary.courseId;
      combined.intakeId = summary.intakeId;
      combined.courseCode = summary.courseCode;
      combined.courseName = summary.courseName;
      combined.intakeNumber = summary.intakeNumber;
    }
  }

  return combined!;
}
