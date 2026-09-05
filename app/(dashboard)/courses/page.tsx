export const dynamic = "force-dynamic";

import Link from "next/link";
import { Barlow_Condensed } from "next/font/google";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { CoursesFolderGrid } from "./_components/courses-folder-grid";
import { PrintButton } from "@/components/print-button";
import { Plus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canManageCourses } from "@/lib/auth/guards";

const courseDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-course-display",
});

export default async function CoursesPage() {
  const user = await getSessionUser();

  const data = await db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      durationWeeks: courses.durationWeeks,
      passingMark: courses.passingMark,
      intakeCount: sql<number>`(
        SELECT COUNT(*) FROM course_intakes
        WHERE course_intakes.course_id = courses.course_id
      )`.as("intake_count"),
    })
    .from(courses)
    .where(eq(courses.isActive, true))
    .orderBy(courses.courseCode);

  const folders = data.map((row) => ({
    ...row,
    intakeCount: Number(row.intakeCount) || 0,
  }));

  return (
    <div className={`space-y-8 ${courseDisplay.variable}`}>
      <PageHeader
        title="Courses"
        description="Open a course folder to view its intakes"
      >
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

      <CoursesFolderGrid data={folders} />
    </div>
  );
}
