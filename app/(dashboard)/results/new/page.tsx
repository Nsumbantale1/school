import { db } from "@/lib/db";
import {
  enrollments,
  students,
  courseIntakes,
  courses,
  courseSubjects,
} from "@/lib/db/schema";
import { eq, desc, or, asc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { ResultForm } from "../_components/result-form";
import { requireAuth, canManageResults } from "@/lib/auth/guards";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ enrollmentId?: string }>;
}

export default async function NewResultPage({ searchParams }: PageProps) {
  const user = await requireAuth();

  if (!canManageResults(user.role)) {
    redirect("/results");
  }

  const params = await searchParams;

  // Get enrollments based on role
  let enrollmentsQuery = db
    .select({
      enrollmentId: enrollments.enrollmentId,
      studentArmyNumber: students.armyNumber,
      fullName: students.fullName,
      rank: students.rank,
      courseCode: courses.courseCode,
      intakeNumber: courseIntakes.intakeNumber,
      courseId: courses.courseId,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(
      or(
        eq(enrollments.status, "enrolled"),
        eq(enrollments.status, "in_progress")
      )
    )
    .orderBy(desc(courseIntakes.year), students.fullName);

  let activeEnrollments = await enrollmentsQuery;

  // For instructors, filter to only their assigned course
  if (user.role === "instructor" && user.assignedCourseId) {
    activeEnrollments = activeEnrollments.filter(
      (e) => e.courseId === user.assignedCourseId
    );
  }

  const subjectRows = await db
    .select({
      courseId: courseSubjects.courseId,
      subjectName: courseSubjects.subjectName,
      maxMarks: courseSubjects.maxMarks,
    })
    .from(courseSubjects)
    .orderBy(asc(courseSubjects.sortOrder));

  const subjectsByCourse: Record<
    number,
    { subjectName: string; maxMarks: string }[]
  > = {};
  for (const r of subjectRows) {
    (subjectsByCourse[r.courseId] ??= []).push({
      subjectName: r.subjectName,
      maxMarks: String(r.maxMarks),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Result"
        description="Enter exam or assessment result"
      >
        <BackButton fallbackHref="/results" />
      </PageHeader>
      <ResultForm
        enrollments={activeEnrollments}
        subjectsByCourse={subjectsByCourse}
        defaultEnrollmentId={
          params.enrollmentId ? parseInt(params.enrollmentId) : undefined
        }
      />
    </div>
  );
}
