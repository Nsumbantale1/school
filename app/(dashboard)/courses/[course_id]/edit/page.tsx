export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { courses, courseSubjects } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { CourseForm } from "../../_components/course-form";
import { requireRole } from "@/lib/auth/guards";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ course_id: string }>;
}) {
  await requireRole(["admin"]);
  const { course_id } = await params;
  const courseId = parseInt(course_id);

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.courseId, courseId))
    .limit(1);

  if (!course) notFound();

  const subjects = await db
    .select({
      subjectName: courseSubjects.subjectName,
      maxMarks: courseSubjects.maxMarks,
    })
    .from(courseSubjects)
    .where(eq(courseSubjects.courseId, courseId))
    .orderBy(asc(courseSubjects.sortOrder));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Course"
        description={`${course.courseCode} — ${course.courseName}`}
      />
      <CourseForm
        initialData={{
          courseId: course.courseId,
          courseCode: course.courseCode,
          courseName: course.courseName,
          durationWeeks: course.durationWeeks,
          passingMark: course.passingMark,
          description: course.description,
          subjects: subjects.map((s) => ({
            subjectName: s.subjectName,
            maxMarks: String(s.maxMarks),
          })),
        }}
      />
    </div>
  );
}
