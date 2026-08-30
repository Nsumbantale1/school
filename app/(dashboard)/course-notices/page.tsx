export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { CourseNoticesGrid } from "./_components/course-notices-grid";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Notices"
        description="Select a course, then choose a subject to view or upload notices. Training exercises are managed per course."
      >
        <BackButton fallbackHref="/dashboard" />
      </PageHeader>

      <CourseNoticesGrid
        courses={data.map((c) => ({
          courseId: c.courseId,
          courseCode: c.courseCode,
          courseName: c.courseName,
          durationWeeks: c.durationWeeks,
          noticeCount: Number(c.noticeCount),
          exerciseCount: Number(c.exerciseCount),
        }))}
      />
    </div>
  );
}
