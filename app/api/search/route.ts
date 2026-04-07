import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, courses, courseIntakes } from "@/lib/db/schema";
import { ilike, or, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

interface SearchResult {
  type: "student" | "course" | "intake";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

export async function GET(request: NextRequest) {
  // Verify user is authenticated
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const searchPattern = `%${query}%`;
  const results: SearchResult[] = [];

  try {
    // Search students
    const matchingStudents = await db
      .select({
        armyNumber: students.armyNumber,
        fullName: students.fullName,
        rank: students.rank,
        unit: students.unit,
      })
      .from(students)
      .where(
        or(
          ilike(students.armyNumber, searchPattern),
          ilike(students.fullName, searchPattern),
          ilike(students.rank, searchPattern)
        )
      )
      .limit(5);

    for (const student of matchingStudents) {
      results.push({
        type: "student",
        id: student.armyNumber,
        title: `${student.rank} ${student.fullName}`,
        subtitle: `${student.armyNumber}${student.unit ? ` - ${student.unit}` : ""}`,
        url: `/students/${student.armyNumber}`,
      });
    }

    // Search courses
    const matchingCourses = await db
      .select({
        courseId: courses.courseId,
        courseCode: courses.courseCode,
        courseName: courses.courseName,
        durationWeeks: courses.durationWeeks,
      })
      .from(courses)
      .where(
        or(
          ilike(courses.courseCode, searchPattern),
          ilike(courses.courseName, searchPattern)
        )
      )
      .limit(5);

    for (const course of matchingCourses) {
      results.push({
        type: "course",
        id: String(course.courseId),
        title: course.courseName,
        subtitle: `${course.courseCode} - ${course.durationWeeks} weeks`,
        url: `/courses/${course.courseId}`,
      });
    }

    // Search intakes
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
        or(
          ilike(courseIntakes.intakeNumber, searchPattern),
          ilike(courses.courseCode, searchPattern),
          ilike(courses.courseName, searchPattern)
        )
      )
      .limit(5);

    for (const intake of matchingIntakes) {
      results.push({
        type: "intake",
        id: String(intake.intakeId),
        title: `${intake.courseName} - ${intake.intakeNumber}`,
        subtitle: `${intake.courseCode} (${intake.year})`,
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
