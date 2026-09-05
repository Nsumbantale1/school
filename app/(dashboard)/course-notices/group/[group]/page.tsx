export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Barlow_Condensed } from "next/font/google";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import {
  getLevelGroupMeta,
  resolveNoticeGroup,
} from "@/lib/utils/notice-course-groups";
import { getCourseDisplayMeta } from "@/lib/utils/course-catalog";
import { LevelsGrid } from "../../_components/levels-grid";

const courseDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-course-display",
});

export default async function NoticeGroupLevelsPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group } = await params;
  const meta = getLevelGroupMeta(group);
  if (!meta) notFound();

  const all = await db
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

  const levels = all
    .map((c) => {
      const resolved = resolveNoticeGroup(c.courseCode, c.courseName);
      const display = getCourseDisplayMeta(c.courseCode, c.courseName);
      return {
        ...c,
        noticeCount: Number(c.noticeCount) || 0,
        exerciseCount: Number(c.exerciseCount) || 0,
        groupKey: resolved.key,
        level: resolved.level ?? display.label,
        label: display.label,
      };
    })
    .filter((c) => c.groupKey === group)
    .sort((a, b) => (a.level || "").localeCompare(b.level || ""));

  if (levels.length === 0) notFound();

  return (
    <div className={`space-y-6 ${courseDisplay.variable}`}>
      <PageHeader
        title={meta.title}
        description="Chagua level kuona notices zake zote"
      >
        <BackButton fallbackHref="/course-notices" />
      </PageHeader>

      <LevelsGrid
        groupTitle={meta.title}
        family={meta.family}
        levels={levels.map((l) => ({
          courseId: l.courseId,
          level: l.level || l.label,
          label: l.label,
          noticeCount: l.noticeCount,
          exerciseCount: l.exerciseCount,
          durationWeeks: l.durationWeeks,
        }))}
      />
    </div>
  );
}
