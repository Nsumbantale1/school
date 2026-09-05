export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Barlow_Condensed } from "next/font/google";
import { db } from "@/lib/db";
import { courses, courseIntakes, enrollments } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, Target, Plus, UserPlus } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { getSessionUser } from "@/lib/auth";
import { canManageEnrollments, canManageCourses } from "@/lib/auth/guards";
import { getCourseDisplayMeta } from "@/lib/utils/course-catalog";
import { CourseIntakesList } from "./_components/course-intakes-list";

const courseDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-course-display",
});

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ course_id: string }>;
}) {
  const { course_id } = await params;
  const courseId = parseInt(course_id, 10);
  if (!Number.isFinite(courseId)) notFound();

  const user = await getSessionUser();
  const canEnroll = !!user && canManageEnrollments(user.role);
  const canEdit = !!user && canManageCourses(user.role);

  const [course, intakes] = await Promise.all([
    db.query.courses.findFirst({
      where: eq(courses.courseId, courseId),
      columns: {
        courseId: true,
        courseCode: true,
        courseName: true,
        durationWeeks: true,
        passingMark: true,
        isActive: true,
      },
    }),
    db
      .select({
        intakeId: courseIntakes.intakeId,
        intakeNumber: courseIntakes.intakeNumber,
        year: courseIntakes.year,
        commanderName: courseIntakes.commanderName,
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
        courseIntakes.startDate,
        courseIntakes.endDate,
        courseIntakes.isActive
      )
      .orderBy(desc(courseIntakes.year), desc(courseIntakes.intakeNumber)),
  ]);

  if (!course) notFound();

  const display = getCourseDisplayMeta(course.courseCode, course.courseName);
  const intakeRows = intakes.map((i) => ({
    ...i,
    studentCount: Number(i.studentCount) || 0,
  }));
  const defaultIntake =
    intakeRows.find((i) => i.isActive) ?? intakeRows[0] ?? null;

  return (
    <div className={`space-y-6 ${courseDisplay.variable}`}>
      <PageHeader
        title={display.label}
        description={`${course.courseName} · ${intakeRows.length} intake${intakeRows.length === 1 ? "" : "s"}`}
      >
        {canEnroll && defaultIntake && (
          <Button asChild>
            <Link
              href={`/enrollments/new?courseId=${courseId}&intakeId=${defaultIntake.intakeId}`}
              prefetch={false}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Student
            </Link>
          </Button>
        )}
        {canEdit && (
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={`/intakes/new?courseId=${courseId}`} prefetch={false}>
                <Plus className="mr-2 h-4 w-4" />
                New Intake
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/courses/${courseId}/edit`} prefetch={false}>
                Edit
              </Link>
            </Button>
          </>
        )}
        <BackButton fallbackHref="/courses" />
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-5 pb-5">
            <div className="rounded-md bg-primary/10 p-2">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-medium">{course.durationWeeks} weeks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5 pb-5">
            <div className="rounded-md bg-primary/10 p-2">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Passing Mark</p>
              <p className="text-sm font-medium">{course.passingMark}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5 pb-5">
            <div className="rounded-md bg-primary/10 p-2">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Intakes</p>
              <p className="text-sm font-medium">{intakeRows.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex items-end justify-between border-b border-[#ddd6c6] pb-2 dark:border-border">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5c6b5c] dark:text-muted-foreground">
              Course intakes
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Labels use <span className="font-medium text-foreground">14/25</span>{" "}
              (same year) or{" "}
              <span className="font-medium text-foreground">14/25-26</span>{" "}
              (across years)
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Tap a card to open
          </span>
        </div>
        <CourseIntakesList courseId={courseId} intakes={intakeRows} />
      </section>
    </div>
  );
}
