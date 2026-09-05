export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  courses,
  courseSubjects,
  courseNotices,
  users,
} from "@/lib/db/schema";
import { eq, desc, or, isNull, gt, and } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { NoticeUploadForm } from "../_components/notice-upload-form";
import { NoticesList } from "../_components/notices-list";
import { SubjectDownloadButton } from "../_components/subject-download-button";
import { getSessionUser } from "@/lib/auth";
import { assertCanAccessCourse } from "@/lib/auth/permissions";

export default async function SubjectNoticesPage({
  params,
}: {
  params: Promise<{ course_id: string; subject_id: string }>;
}) {
  const { course_id, subject_id } = await params;
  const courseId = parseInt(course_id);
  const subjectId = parseInt(subject_id);
  const user = await getSessionUser();
  const canManage = !!user && assertCanAccessCourse(user, courseId);

  const subject = await db.query.courseSubjects.findFirst({
    where: and(
      eq(courseSubjects.subjectId, subjectId),
      eq(courseSubjects.courseId, courseId)
    ),
    with: { course: true },
  });
  if (!subject) notFound();

  const now = new Date();

  const notices = await db
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
    })
    .from(courseNotices)
    .leftJoin(users, eq(courseNotices.createdBy, users.id))
    .where(
      and(
        eq(courseNotices.subjectId, subjectId),
        or(isNull(courseNotices.expiresAt), gt(courseNotices.expiresAt, now))
      )
    )
    .orderBy(desc(courseNotices.isPinned), desc(courseNotices.createdAt));

  return (
    <div className="space-y-6">
      <PageHeader
        title={subject.subjectName}
        description={`${subject.course.courseCode} — ${subject.course.courseName}`}
      >
        <BackButton fallbackHref={`/course-notices/${courseId}`} />
      </PageHeader>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Subject Notice</CardTitle>
            <CardDescription>
              Publish a notice for {subject.subjectName}. You can attach a PDF or
              document.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NoticeUploadForm courseId={courseId} subjectId={subjectId} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Subject Notices</CardTitle>
            <CardDescription>
              Download notices to print or share with students.
            </CardDescription>
          </div>
          <SubjectDownloadButton
            subjectId={subjectId}
            disabled={notices.length === 0}
          />
        </CardHeader>
        <CardContent>
          <NoticesList
            notices={notices.map((n) => ({
              ...n,
              expiresAt: n.expiresAt?.toISOString() ?? null,
              createdAt: n.createdAt.toISOString(),
            }))}
            courseId={courseId}
            subjectId={subjectId}
            canManage={!!canManage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
