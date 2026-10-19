import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, courses, courseIntakes, enrollments } from "@/lib/db/schema";
import { ilike, or, eq, and, sql, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { studentPath } from "@/lib/utils";
import { displayName, nameOrderForCourses } from "@/lib/utils/display-name";

interface SearchResult {
  type: "student" | "course" | "intake";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const searchPattern = `%${query}%`;
  const prefixPattern = `${query}%`;
  const results: SearchResult[] = [];

  try {
    // Search by name, army number, or current rank
    const matchingStudents = await db
      .select({
        armyNumber: students.armyNumber,
        fullName: students.fullName,
        rank: students.rank,
        unit: students.unit,
      })
      .from(students)
      .where(
        and(
          eq(students.isActive, true),
          or(
            ilike(students.armyNumber, searchPattern),
            ilike(students.fullName, searchPattern),
            ilike(students.rank, searchPattern)
          )
        )
      )
      .orderBy(
        sql`case
          when ${students.fullName} ilike ${prefixPattern} then 0
          when ${students.armyNumber} ilike ${prefixPattern} then 1
          else 2
        end`,
        students.fullName
      )
      .limit(5);

    const armyNumbers = matchingStudents.map((student) => student.armyNumber);
    const courseRows =
      armyNumbers.length === 0
        ? []
        : await db
            .select({
              armyNumber: enrollments.studentArmyNumber,
              courseCode: courses.courseCode,
              courseName: courses.courseName,
            })
            .from(enrollments)
            .innerJoin(
              courseIntakes,
              eq(enrollments.intakeId, courseIntakes.intakeId)
            )
            .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
            .where(inArray(enrollments.studentArmyNumber, armyNumbers));
    const coursesByStudent = new Map<
      string,
      { courseCode: string; courseName: string }[]
    >();
    for (const row of courseRows) {
      const list = coursesByStudent.get(row.armyNumber) ?? [];
      list.push({ courseCode: row.courseCode, courseName: row.courseName });
      coursesByStudent.set(row.armyNumber, list);
    }

    for (const student of matchingStudents) {
      const details = [
        `Current: ${student.rank}`,
        student.armyNumber,
        student.unit || null,
      ].filter(Boolean);

      results.push({
        type: "student",
        id: student.armyNumber,
        title: displayName(
          student.fullName,
          nameOrderForCourses(coursesByStudent.get(student.armyNumber) ?? [])
        ),
        subtitle: details.join(" · "),
        url: studentPath(student.armyNumber),
      });
    }

    const matchingCourses = await db
      .select({
        courseId: courses.courseId,
        courseCode: courses.courseCode,
        courseName: courses.courseName,
        durationWeeks: courses.durationWeeks,
      })
      .from(courses)
      .where(
        and(
          eq(courses.isActive, true),
          or(
            ilike(courses.courseCode, searchPattern),
            ilike(courses.courseName, searchPattern)
          )
        )
      )
      .limit(3);

    for (const course of matchingCourses) {
      results.push({
        type: "course",
        id: String(course.courseId),
        title: course.courseName,
        subtitle: `${course.courseCode} · ${course.durationWeeks} weeks`,
        url: `/courses/${course.courseId}`,
      });
    }

    const matchingIntakes = await db
      .select({
        intakeId: courseIntakes.intakeId,
        intakeNumber: courseIntakes.intakeNumber,
        year: courseIntakes.year,
        courseCode: courses.courseCode,
        courseName: courses.courseName,
      })
      .from(courseIntakes)
      .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
      .where(
        and(
          eq(courseIntakes.isActive, true),
          or(
            ilike(courseIntakes.intakeNumber, searchPattern),
            ilike(courses.courseCode, searchPattern)
          )
        )
      )
      .limit(3);

    for (const intake of matchingIntakes) {
      results.push({
        type: "intake",
        id: String(intake.intakeId),
        title: intake.intakeNumber,
        subtitle: `${intake.courseCode} · ${intake.courseName} (${intake.year})`,
        url: `/intakes/${intake.intakeId}`,
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed", results: [] },
      { status: 500 }
    );
  }
}
