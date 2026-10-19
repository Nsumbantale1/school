import { NextResponse } from "next/server";
import { eq, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  courseIntakes,
  courseSubjects,
  courses,
  enrollments,
  results,
  students,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { buildIntakeWorkbook } from "@/lib/utils/intake-excel";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ intake_id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { intake_id } = await context.params;
  const intakeId = parseInt(intake_id, 10);
  if (!Number.isFinite(intakeId)) {
    return NextResponse.json({ error: "Invalid intake" }, { status: 400 });
  }

  const [intake] = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      startDate: courseIntakes.startDate,
      endDate: courseIntakes.endDate,
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);

  if (!intake) {
    return NextResponse.json({ error: "Intake not found" }, { status: 404 });
  }

  const [roster, catalog, markRows] = await Promise.all([
    db
      .select({
        enrollmentId: enrollments.enrollmentId,
        armyNumber: students.armyNumber,
        rank: enrollments.rankAtEnrollment,
        fullName: students.fullName,
        unit: enrollments.unitAtEnrollment,
        averageMarks: enrollments.averageMarks,
        grade: enrollments.grade,
        position: enrollments.position,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
      .where(eq(enrollments.intakeId, intakeId))
      .orderBy(
        sql`${enrollments.averageMarks} DESC NULLS LAST`,
        sql`${enrollments.position} ASC NULLS LAST`,
        enrollments.studentArmyNumber
      ),
    db
      .select({
        subjectName: courseSubjects.subjectName,
        sortOrder: courseSubjects.sortOrder,
      })
      .from(courseSubjects)
      .where(eq(courseSubjects.courseId, intake.courseId))
      .orderBy(asc(courseSubjects.sortOrder), asc(courseSubjects.subjectName)),
    db
      .select({
        enrollmentId: results.enrollmentId,
        subjectName: results.subjectName,
        marksObtained: results.marksObtained,
        resultId: results.resultId,
      })
      .from(results)
      .innerJoin(enrollments, eq(results.enrollmentId, enrollments.enrollmentId))
      .where(eq(enrollments.intakeId, intakeId))
      .orderBy(asc(results.resultId)),
  ]);

  const { buffer, filename } = await buildIntakeWorkbook({
    courseCode: intake.courseCode,
    courseName: intake.courseName,
    intakeNumber: intake.intakeNumber,
    startDate: intake.startDate,
    endDate: intake.endDate,
    students: roster,
    subjects: catalog.map((subject) => ({
      subjectName: subject.subjectName,
      sortOrder: subject.sortOrder,
    })),
    marks: markRows,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
