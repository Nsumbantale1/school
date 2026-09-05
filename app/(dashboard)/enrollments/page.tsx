export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { enrollments, students, courseIntakes, courses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EnrollmentsTable } from "./_components/enrollments-table";
import { PrintButton } from "@/components/print-button";
import { Plus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canManageEnrollments } from "@/lib/auth/guards";

export default async function EnrollmentsPage() {
  const user = await getSessionUser();

  const data = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      studentArmyNumber: enrollments.studentArmyNumber,
      fullName: students.fullName,
      rank: enrollments.rankAtEnrollment,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      status: enrollments.status,
      unit: students.unit,
      averageMarks: enrollments.averageMarks,
      grade: enrollments.grade,
      position: enrollments.position,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .orderBy(desc(courseIntakes.year), courseIntakes.intakeNumber);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrollments"
        description="Search students by score, unit, course, grade, or name"
      >
        <PrintButton title="Enrollments — School of Field Artillery" />
        {user && canManageEnrollments(user.role) && (
          <Button asChild>
            <Link href="/enrollments/new">
              <Plus className="mr-2 h-4 w-4" />
              New Enrollment
            </Link>
          </Button>
        )}
      </PageHeader>
      <EnrollmentsTable data={data} />
    </div>
  );
}
