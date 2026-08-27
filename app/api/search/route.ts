import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, courses, courseIntakes } from "@/lib/db/schema";
import { ilike, or, eq, and, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { studentPath } from "@/lib/utils";

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
    // Name / army number only — searching by rank floods results
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
            ilike(students.fullName, searchPattern)
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

    for (const student of matchingStudents) {
      const details = [
        student.rank,
        student.armyNumber,
        student.unit || null,
      ].filter(Boolean);

      results.push({
        type: "student",
        id: student.armyNumber,
        title: student.fullName,
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
