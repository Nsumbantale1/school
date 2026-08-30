import { NextResponse } from "next/server";
import { eq, and, or, isNull, gt, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseNotices, courseSubjects, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import {
  buildSubjectNoticesZip,
  subjectZipFilename,
} from "@/lib/utils/notice-download";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { subjectId } = await params;
  const id = parseInt(subjectId);
  if (!id) {
    return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
  }

  const subject = await db.query.courseSubjects.findFirst({
    where: eq(courseSubjects.subjectId, id),
    with: { course: true },
  });

  if (!subject) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  const now = new Date();

  const notices = await db
    .select({
      id: courseNotices.id,
      title: courseNotices.title,
      body: courseNotices.body,
      category: courseNotices.category,
      priority: courseNotices.priority,
      isPinned: courseNotices.isPinned,
      createdAt: courseNotices.createdAt,
      expiresAt: courseNotices.expiresAt,
      attachmentPath: courseNotices.attachmentPath,
      attachmentName: courseNotices.attachmentName,
      authorName: users.name,
    })
    .from(courseNotices)
    .leftJoin(users, eq(courseNotices.createdBy, users.id))
    .where(
      and(
        eq(courseNotices.subjectId, id),
        or(isNull(courseNotices.expiresAt), gt(courseNotices.expiresAt, now))
      )
    )
    .orderBy(desc(courseNotices.isPinned), desc(courseNotices.createdAt));

  try {
    const buffer = await buildSubjectNoticesZip(notices, {
      courseCode: subject.course.courseCode,
      courseName: subject.course.courseName,
      subjectName: subject.subjectName,
    });

    const filename = subjectZipFilename(
      subject.course.courseCode,
      subject.subjectName
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Subject notices zip download failed:", error);
    return NextResponse.json(
      { error: "Failed to create download package." },
      { status: 500 }
    );
  }
}
