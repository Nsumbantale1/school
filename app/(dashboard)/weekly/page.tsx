export const dynamic = "force-dynamic";

import { Barlow_Condensed } from "next/font/google";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { CoursesFolderGrid } from "@/app/(dashboard)/courses/_components/courses-folder-grid";

const courseDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-course-display",
});

export default async function WeeklyPage() {
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
        title="Weekly & Monthly Test"
        description="Open a course. Its own intakes are listed inside."
      >
        <BackButton fallbackHref="/dashboard" />
      </PageHeader>
      <CoursesFolderGrid data={folders} folderBase="/weekly/course" />
    </div>
  );
}
