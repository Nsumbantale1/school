import { NextResponse } from "next/server";
import { eq, and, or, isNull, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  courseNotices,
  courseSubjects,
  courses,
  users,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { buildNoticePdfBuffer, noticePdfFilename } from "@/lib/utils/notice-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ noticeId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { noticeId } = await params;
  const id = parseInt(noticeId);
  if (!id) {
    return NextResponse.json({ error: "Invalid notice" }, { status: 400 });
  }

  const now = new Date();

  const [row] = await db
    .select({
      id: courseNotices.id,
      title: courseNotices.title,
      body: courseNotices.body,
      category: courseNotices.category,
      priority: courseNotices.priority,
      isPinned: courseNotices.isPinned,
      createdAt: courseNotices.createdAt,
      expiresAt: courseNotices.expiresAt,
      attachmentName: courseNotices.attachmentName,
      authorName: users.name,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      subjectName: courseSubjects.subjectName,
    })
    .from(courseNotices)
    .innerJoin(courseSubjects, eq(courseNotices.subjectId, courseSubjects.subjectId))
    .innerJoin(courses, eq(courseNotices.courseId, courses.courseId))
    .leftJoin(users, eq(courseNotices.createdBy, users.id))
    .where(
      and(
        eq(courseNotices.id, id),
        or(isNull(courseNotices.expiresAt), gt(courseNotices.expiresAt, now))
      )
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  }

  try {
    const buffer = await buildNoticePdfBuffer({
      title: row.title,
      body: row.body,
      category: row.category,
      priority: row.priority,
      isPinned: row.isPinned,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      authorName: row.authorName,
      attachmentName: row.attachmentName,
      courseCode: row.courseCode,
      courseName: row.courseName,
      subjectName: row.subjectName,
    });

    const filename = noticePdfFilename({
      title: row.title,
      body: row.body,
      category: row.category,
      priority: row.priority,
      isPinned: row.isPinned,
      createdAt: row.createdAt,
      courseCode: row.courseCode,
      courseName: row.courseName,
      subjectName: row.subjectName,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Notice PDF download failed:", error);
    return NextResponse.json(
      { error: "Failed to generate notice PDF." },
      { status: 500 }
    );
  }
}
