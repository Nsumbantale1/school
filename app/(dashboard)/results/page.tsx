export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import {
  results,
  enrollments,
  students,
  courseIntakes,
  courses,
  users,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ResultsTable } from "./_components/results-table";
import { PrintButton } from "@/components/print-button";
import { Plus, Upload } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canManageResults } from "@/lib/auth/guards";

export default async function ResultsPage() {
  const user = await getSessionUser();

  const data = await db
    .select({
      resultId: results.resultId,
      studentArmyNumber: students.armyNumber,
      fullName: students.fullName,
      unit: students.unit,
      rank: enrollments.rankAtEnrollment,
      courseCode: courses.courseCode,
      intakeNumber: courseIntakes.intakeNumber,
      subjectName: results.subjectName,
      marksObtained: results.marksObtained,
      maxMarks: results.maxMarks,
      grade: results.grade,
      enteredByName: users.name,
    })
    .from(results)
    .innerJoin(enrollments, eq(results.enrollmentId, enrollments.enrollmentId))
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .leftJoin(users, eq(results.enteredBy, users.id))
    .orderBy(desc(results.createdAt));

  return (
    <div className="space-y-6">
      <PageHeader title="Results" description="Student exam and assessment results">
        <PrintButton title="Results — School of Field Artillery" />
        {user && canManageResults(user.role) && (
          <>
            <Button variant="outline" asChild>
              <Link href="/results/import">
                <Upload className="mr-2 h-4 w-4" />
                Import Excel/CSV
              </Link>
            </Button>
            <Button asChild>
              <Link href="/results/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Result
              </Link>
            </Button>
          </>
        )}
      </PageHeader>
      <ResultsTable data={data} />
    </div>
  );
}
