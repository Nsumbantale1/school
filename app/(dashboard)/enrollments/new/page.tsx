import { db } from "@/lib/db";
import { students, courseIntakes, courses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { EnrollmentForm } from "../_components/enrollment-form";
import { requireRole } from "@/lib/auth/guards";

interface PageProps {
  searchParams: Promise<{ intakeId?: string; studentArmyNumber?: string }>;
}

export default async function NewEnrollmentPage({ searchParams }: PageProps) {
  await requireRole(["admin"]);
  const params = await searchParams;

  // Get active students
  const activeStudents = await db
    .select({
      armyNumber: students.armyNumber,
      rank: students.rank,
      fullName: students.fullName,
    })
    .from(students)
    .where(eq(students.isActive, true))
    .orderBy(students.fullName);

  // Get active intakes with course info
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
    .where(eq(courses.isActive, true))
    .orderBy(desc(courseIntakes.year), courses.courseCode);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Enrollment"
        description="Enroll a student in a course intake"
      />
      <EnrollmentForm
        students={activeStudents}
        intakes={activeIntakes}
        defaultIntakeId={params.intakeId ? parseInt(params.intakeId) : undefined}
        defaultStudentArmyNumber={params.studentArmyNumber}
      />
    </div>
  );
}
