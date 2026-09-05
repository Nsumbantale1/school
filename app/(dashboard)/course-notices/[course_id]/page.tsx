export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Barlow_Condensed } from "next/font/google";
import { db } from "@/lib/db";
import {
  courses,
  courseSubjects,
  courseExercises,
  courseNotices,
  users,
} from "@/lib/db/schema";
import { eq, sql, desc, or, isNull, gt, and } from "drizzle-orm";
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
import { NoticeUploadForm } from "./_components/notice-upload-form";
import { NoticesList } from "./_components/notices-list";
import { ensureGeneralNoticeSubject } from "../actions";
import { getSessionUser } from "@/lib/auth";
import { assertCanAccessCourse } from "@/lib/auth/permissions";
import { getCourseDisplayMeta } from "@/lib/utils/course-catalog";
import { resolveNoticeGroup } from "@/lib/utils/notice-course-groups";
import { BookOpen, Dumbbell, Megaphone } from "lucide-react";

const courseDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-course-display",
});

export default async function CourseNoticesDetailPage({
  params,
}: {
  params: Promise<{ course_id: string }>;
}) {
  const { course_id } = await params;
  const courseId = parseInt(course_id, 10);
  if (!Number.isFinite(courseId)) notFound();

  const user = await getSessionUser();
  const canManage = !!user && assertCanAccessCourse(user, courseId);

  const course = await db.query.courses.findFirst({
    where: eq(courses.courseId, courseId),
  });
  if (!course) notFound();

  // Always have at least one subject so the upload form works.
  if (canManage) {
    await ensureGeneralNoticeSubject(courseId);
  }

  const display = getCourseDisplayMeta(course.courseCode, course.courseName);
  const group = resolveNoticeGroup(course.courseCode, course.courseName);
  const backHref = group.hasLevels
    ? `/course-notices/group/${group.key}`
    : "/course-notices";
  const title = group.level
    ? `${group.title} · ${group.level}`
    : display.label;

  const now = new Date();

  const [subjects, exercises, notices] = await Promise.all([
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
    db
      .select({
        id: courseNotices.id,
        title: courseNotices.title,
        body: courseNotices.body,
        category: courseNotices.category,
        priority: courseNotices.priority,
        attachmentPath: courseNotices.attachmentPath,
        attachmentName: courseNotices.attachmentName,
        isPinned: courseNotices.isPinned,
        expiresAt: courseNotices.expiresAt,
        createdAt: courseNotices.createdAt,
        authorName: users.name,
        subjectId: courseNotices.subjectId,
        subjectName: courseSubjects.subjectName,
      })
      .from(courseNotices)
      .leftJoin(users, eq(courseNotices.createdBy, users.id))
      .leftJoin(
        courseSubjects,
        eq(courseNotices.subjectId, courseSubjects.subjectId)
      )
      .where(
        and(
          eq(courseNotices.courseId, courseId),
          or(isNull(courseNotices.expiresAt), gt(courseNotices.expiresAt, now))
        )
      )
      .orderBy(desc(courseNotices.isPinned), desc(courseNotices.createdAt)),
  ]);

  const noticeRows = notices.map((n) => ({
    ...n,
    expiresAt: n.expiresAt ? n.expiresAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
    subjectId: n.subjectId ?? undefined,
  }));

  return (
    <div className={`space-y-6 ${courseDisplay.variable}`}>
      <PageHeader
        title={title}
        description={`${course.courseName} · ${noticeRows.length} notice${noticeRows.length === 1 ? "" : "s"}`}
      >
        <BackButton fallbackHref={backHref} />
      </PageHeader>

      <Tabs defaultValue="notices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notices" className="gap-2">
            <Megaphone className="h-4 w-4" />
            Notices ({noticeRows.length})
          </TabsTrigger>
          <TabsTrigger value="subjects" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Subjects ({subjects.length})
          </TabsTrigger>
          <TabsTrigger value="exercises" className="gap-2">
            <Dumbbell className="h-4 w-4" />
            Training ({exercises.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notices" className="space-y-4">
          {canManage ? (
            <Card className="border-[#1a5c2e]/25 bg-[#fbf9f4]/80 shadow-sm dark:bg-card">
              <CardHeader>
                <CardTitle className="text-base">Upload notice</CardTitle>
                <CardDescription>
                  Chapisha notice kwa level / kozi hii. Unaweza kuambatanisha
                  faili (PDF, Word, Excel, picha).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NoticeUploadForm
                  courseId={courseId}
                  subjects={subjects.map((s) => ({
                    subjectId: s.subjectId,
                    subjectName: s.subjectName,
                  }))}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-4 text-sm text-muted-foreground">
                Login as admin or the assigned instructor to upload notices.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">All notices — {title}</CardTitle>
              <CardDescription>
                Notices zote za level hii (kutoka subjects zote)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NoticesList
                notices={noticeRows}
                courseId={courseId}
                canManage={!!canManage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subjects</CardTitle>
              <CardDescription>
                Fungua subject kuona notices zake pekee au kupakua ZIP
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
                <CardTitle className="text-base">Add exercise</CardTitle>
              </CardHeader>
              <CardContent>
                <ExerciseForm courseId={courseId} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Training programme</CardTitle>
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
