export const dynamic = "force-dynamic";

import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseIntakes, courses } from "@/lib/db/schema";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { formatDatePeriod } from "@/lib/utils/format-date";
import { formatIntakeLabel } from "@/lib/utils/intake-label";
import { getCourseDisplayMeta } from "@/lib/utils/course-catalog";
import {
  currentTrainingMonth,
  trainingMonths,
  trainingWeekStatus,
} from "@/lib/utils/training-week";
import { WeeklyIntakeList } from "./_components/weekly-intake-list";

export default async function WeeklyPage() {
  const currentYear = new Date().getFullYear();

  const intakes = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      startDate: courseIntakes.startDate,
      endDate: courseIntakes.endDate,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      durationWeeks: courses.durationWeeks,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(
      and(
        eq(courseIntakes.isActive, true),
        eq(courses.isActive, true),
        gte(courseIntakes.year, currentYear - 1)
      )
    );

  const items = intakes.flatMap((intake) => {
    const status = trainingWeekStatus({
      startDate: intake.startDate,
      endDate: intake.endDate,
      durationWeeks: intake.durationWeeks,
    });
    if (status.phase === "completed") return [];
    if (status.phase === "upcoming" && intake.year < currentYear) return [];
    const meta = getCourseDisplayMeta(intake.courseCode, intake.courseName);
    const totalMonths = trainingMonths(intake.durationWeeks);
    const month = currentTrainingMonth(status.week, totalMonths, status.phase);
    return [
      {
        intakeId: intake.intakeId,
        title: meta.label,
        courseCode: intake.courseCode,
        courseName: intake.courseName,
        intakeLabel: formatIntakeLabel({
          intakeNumber: intake.intakeNumber,
          startDate: intake.startDate,
          endDate: intake.endDate,
          year: intake.year,
        }),
        intakeNumber: intake.intakeNumber,
        week: status.week,
        totalWeeks: status.totalWeeks,
        month,
        totalMonths,
        phase: status.phase,
        period: formatDatePeriod(intake.startDate, intake.endDate),
      },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly & Monthly Test"
        description="Progress chart — weekly tests, then a monthly test after every three weeks"
      >
        <BackButton fallbackHref="/dashboard" />
      </PageHeader>
      <WeeklyIntakeList items={items} />
    </div>
  );
}
