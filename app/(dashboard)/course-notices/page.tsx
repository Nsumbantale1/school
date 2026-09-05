export const dynamic = "force-dynamic";

import { Barlow_Condensed } from "next/font/google";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { NoticesCourseFolders } from "./_components/notices-course-folders";
import { buildNoticeFolders } from "@/lib/utils/notice-course-groups";

const courseDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-course-display",
});

export default async function CourseNoticesIndexPage() {
  const data = await db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      durationWeeks: courses.durationWeeks,
      noticeCount: sql<number>`(
        SELECT COUNT(*) FROM course_notices
        WHERE course_notices.course_id = ${courses.courseId}
      )`,
      exerciseCount: sql<number>`(
        SELECT COUNT(*) FROM course_exercises
        WHERE course_exercises.course_id = ${courses.courseId}
      )`,
    })
    .from(courses)
    .where(eq(courses.isActive, true))
    .orderBy(courses.courseCode);

  const folders = buildNoticeFolders(
    data.map((c) => ({
      courseId: c.courseId,
      courseCode: c.courseCode,
      courseName: c.courseName,
      durationWeeks: c.durationWeeks,
      noticeCount: Number(c.noticeCount) || 0,
      exerciseCount: Number(c.exerciseCount) || 0,
    }))
  );

  return (
    <div className={`space-y-6 ${courseDisplay.variable}`}>
      <PageHeader
        title="Course Notices"
        description="Fungua kozi — kama ina levels, chagua level kisha uone notices zote"
      >
        <BackButton fallbackHref="/dashboard" />
      </PageHeader>

      <NoticesCourseFolders folders={folders} />
    </div>
  );
}
