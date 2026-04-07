export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { courses, courseIntakes } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { CoursesTable } from "./_components/courses-table";
import { PrintButton } from "@/components/print-button";
import { Plus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canManageCourses } from "@/lib/auth/guards";

export default async function CoursesPage() {
  const user = await getSessionUser();

  // Get courses with intake count
  const data = await db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      durationWeeks: courses.durationWeeks,
      passingMark: courses.passingMark,
      description: courses.description,
      intakeCount: sql<number>`(
        SELECT COUNT(*) FROM course_intakes
        WHERE course_intakes.course_id = courses.course_id
      )`.as("intake_count"),
    })
    .from(courses)
    .where(eq(courses.isActive, true))
    .orderBy(courses.courseCode);

  return (
    <div className="space-y-6">
      <PageHeader title="Courses" description="Manage training courses">
        <PrintButton title="Courses List — School of Field Artillery" />
        {user && canManageCourses(user.role) && (
          <Button asChild>
            <Link href="/courses/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Course
            </Link>
          </Button>
        )}
      </PageHeader>
      <CoursesTable data={data} />
    </div>
  );
}
