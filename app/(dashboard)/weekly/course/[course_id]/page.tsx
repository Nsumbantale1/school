import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { Barlow_Condensed } from "next/font/google";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { courseIntakes, courses, enrollments } from "@/lib/db/schema";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getCourseDisplayMeta } from "@/lib/utils/course-catalog";
import { CourseIntakesList } from "@/app/(dashboard)/courses/[course_id]/_components/course-intakes-list";

export const dynamic = "force-dynamic";

const courseDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-course-display",
});

export default async function WeeklyCoursePage({
  params,
}: {
  params: Promise<{ course_id: string }>;
}) {
  const courseId = parseInt((await params).course_id, 10);
  if (!Number.isFinite(courseId)) notFound();

  const [course, intakes] = await Promise.all([
    db.query.courses.findFirst({
      where: eq(courses.courseId, courseId),
      columns: {
        courseId: true,
        courseCode: true,
        courseName: true,
        isActive: true,
      },
    }),
    db
      .select({
        intakeId: courseIntakes.intakeId,
        intakeNumber: courseIntakes.intakeNumber,
        year: courseIntakes.year,
        commanderName: courseIntakes.commanderName,
        coordinatorName: courseIntakes.coordinatorName,
        startDate: courseIntakes.startDate,
        endDate: courseIntakes.endDate,
        isActive: courseIntakes.isActive,
        studentCount: sql<number>`coalesce(count(${enrollments.enrollmentId}), 0)`,
      })
      .from(courseIntakes)
      .leftJoin(enrollments, eq(enrollments.intakeId, courseIntakes.intakeId))
      .where(eq(courseIntakes.courseId, courseId))
      .groupBy(
        courseIntakes.intakeId,
        courseIntakes.intakeNumber,
        courseIntakes.year,
        courseIntakes.commanderName,
        courseIntakes.coordinatorName,
        courseIntakes.startDate,
        courseIntakes.endDate,
        courseIntakes.isActive
      )
      .orderBy(desc(courseIntakes.year), desc(courseIntakes.intakeNumber)),
  ]);

  if (!course || !course.isActive) notFound();

  const display = getCourseDisplayMeta(course.courseCode, course.courseName);
  const intakeRows = intakes.map((intake) => ({
    ...intake,
    studentCount: Number(intake.studentCount) || 0,
  }));

  return (
    <div className={`space-y-6 ${courseDisplay.variable}`}>
      <PageHeader
        title={display.label}
        description={`${course.courseName} · choose an intake to open its weekly and monthly test chart`}
      >
        <Button variant="outline" asChild>
          <Link href="/weekly">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </PageHeader>
      <section className="space-y-4">
        <div className="flex items-end justify-between border-b border-[#ddd6c6] pb-2 dark:border-border">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5c6b5c] dark:text-muted-foreground">
            Course intakes
          </h2>
          <span className="text-[11px] text-muted-foreground">Tap a card to open the chart</span>
        </div>
        <CourseIntakesList
          courseId={courseId}
          intakes={intakeRows}
          intakeBase="/weekly"
          openLabel="Open chart"
        />
      </section>
    </div>
  );
}
