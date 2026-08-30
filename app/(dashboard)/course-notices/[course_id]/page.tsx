export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { courses, courseSubjects, courseExercises } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubjectsGrid } from "./_components/subjects-grid";
import { ExerciseForm } from "./_components/exercise-form";
import { ExercisesList } from "./_components/exercises-list";
import { getSessionUser } from "@/lib/auth";
import { BookOpen, Dumbbell } from "lucide-react";

export default async function CourseNoticesDetailPage({
  params,
}: {
  params: Promise<{ course_id: string }>;
}) {
  const { course_id } = await params;
  const courseId = parseInt(course_id);
  const user = await getSessionUser();
  const canManage = user?.role === "admin" || user?.role === "instructor";

  const course = await db.query.courses.findFirst({
    where: eq(courses.courseId, courseId),
  });
  if (!course) notFound();

  const [subjects, exercises] = await Promise.all([
    db
      .select({
        subjectId: courseSubjects.subjectId,
        courseId: courseSubjects.courseId,
        subjectName: courseSubjects.subjectName,
        maxMarks: courseSubjects.maxMarks,
        noticeCount: sql<number>`(
          SELECT COUNT(*) FROM course_notices
          WHERE course_notices.subject_id = ${courseSubjects.subjectId}
        )`,
      })
      .from(courseSubjects)
      .where(eq(courseSubjects.courseId, courseId))
      .orderBy(courseSubjects.sortOrder, courseSubjects.subjectName),
    db
      .select({
        id: courseExercises.id,
        weekNumber: courseExercises.weekNumber,
        title: courseExercises.title,
        description: courseExercises.description,
        exerciseType: courseExercises.exerciseType,
        location: courseExercises.location,
        duration: courseExercises.duration,
      })
      .from(courseExercises)
      .where(eq(courseExercises.courseId, courseId))
      .orderBy(courseExercises.weekNumber, courseExercises.sortOrder),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${course.courseCode} — Subjects & Training`}
        description={course.courseName}
      >
        <BackButton fallbackHref="/course-notices" />
      </PageHeader>

      <Tabs defaultValue="subjects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subjects" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Subjects ({subjects.length})
          </TabsTrigger>
          <TabsTrigger value="exercises" className="gap-2">
            <Dumbbell className="h-4 w-4" />
            Training Programme ({exercises.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Course Subjects</CardTitle>
              <CardDescription>
                Select a subject to view and upload notices for {course.courseCode}.
                New subjects added to the course appear here automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubjectsGrid
                subjects={subjects.map((s) => ({
                  subjectId: s.subjectId,
                  courseId: s.courseId,
                  subjectName: s.subjectName,
                  maxMarks: String(s.maxMarks),
                  noticeCount: Number(s.noticeCount),
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exercises" className="space-y-6">
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add Progressive Exercise</CardTitle>
                <CardDescription>
                  Build the training programme week by week for {course.courseCode}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExerciseForm courseId={courseId} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Training Programme</CardTitle>
              <CardDescription>
                Progressive exercises across the {course.durationWeeks}-week course
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExercisesList
                exercises={exercises}
                courseId={courseId}
                canManage={!!canManage}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
