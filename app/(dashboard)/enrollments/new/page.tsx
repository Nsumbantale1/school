import { db } from "@/lib/db";
import { students, courseIntakes, courses } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { EnrollmentForm } from "../_components/enrollment-form";
import { requireRole } from "@/lib/auth/guards";

interface PageProps {
  searchParams: Promise<{
    intakeId?: string;
    courseId?: string;
    studentArmyNumber?: string;
  }>;
}

export default async function NewEnrollmentPage({ searchParams }: PageProps) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const courseId = params.courseId ? parseInt(params.courseId) : undefined;
  const intakeId = params.intakeId ? parseInt(params.intakeId) : undefined;

  const activeStudents = await db
    .select({
      armyNumber: students.armyNumber,
      rank: students.rank,
      fullName: students.fullName,
    })
    .from(students)
    .where(eq(students.isActive, true))
    .orderBy(students.fullName);

  const intakeConditions = [eq(courses.isActive, true)];
  if (courseId) {
    intakeConditions.push(eq(courseIntakes.courseId, courseId));
  }

  const activeIntakes = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(and(...intakeConditions))
    .orderBy(desc(courseIntakes.year), courses.courseCode);

  const selectedCourse = courseId
    ? activeIntakes[0]
      ? { courseCode: activeIntakes[0].courseCode, courseName: activeIntakes[0].courseName }
      : await db
          .select({ courseCode: courses.courseCode, courseName: courses.courseName })
          .from(courses)
          .where(eq(courses.courseId, courseId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
    : null;

  const backHref = courseId ? `/courses/${courseId}` : "/enrollments";

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          selectedCourse
            ? `Add Student — ${selectedCourse.courseCode}`
            : "New Enrollment"
        }
        description={
          selectedCourse
            ? `Enroll a student in ${selectedCourse.courseName}`
            : "Enroll a student in a course intake"
        }
      >
        <BackButton fallbackHref={backHref} />
      </PageHeader>
      <EnrollmentForm
        students={activeStudents}
        intakes={activeIntakes}
        defaultIntakeId={intakeId}
        defaultStudentArmyNumber={params.studentArmyNumber}
        backHref={backHref}
      />
    </div>
  );
}
