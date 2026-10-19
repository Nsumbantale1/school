export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  courseIntakes,
  courses,
  enrollments,
  progressTests,
  students,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { assertCanAccessCourse } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { formatDateOnly, formatDatePeriod } from "@/lib/utils/format-date";
import { formatIntakeLabel } from "@/lib/utils/intake-label";
import { getCourseDisplayMeta } from "@/lib/utils/course-catalog";
import { displayName } from "@/lib/utils/display-name";
import {
  progressCellKey,
  progressColumns,
  rankSeniority,
  type ProgressKind,
} from "@/lib/utils/progress-chart";
import {
  currentTrainingMonth,
  trainingWeekStatus,
} from "@/lib/utils/training-week";
import { ensureProgressTestsTable } from "@/lib/db/ensure-progress-tests";
import { ProgressChart } from "../_components/progress-chart";
import { ProgressImport } from "../_components/progress-import";

export default async function WeeklyIntakePage({
  params,
}: {
  params: Promise<{ intake_id: string }>;
}) {
  const { intake_id } = await params;
  const intakeId = parseInt(intake_id, 10);
  if (!Number.isFinite(intakeId)) notFound();

  const [intake] = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      startDate: courseIntakes.startDate,
      endDate: courseIntakes.endDate,
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      durationWeeks: courses.durationWeeks,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);

  if (!intake) notFound();

  const user = await getSessionUser();
  const canEdit = !!user && assertCanAccessCourse(user, intake.courseId);
  const status = trainingWeekStatus({
    startDate: intake.startDate,
    endDate: intake.endDate,
    durationWeeks: intake.durationWeeks,
  });
  const columns = progressColumns(intake.durationWeeks);
  const monthCount = columns.filter((column) => column.kind === "month").length;
  const meta = getCourseDisplayMeta(intake.courseCode, intake.courseName);
  const intakeLabel = formatIntakeLabel({
    intakeNumber: intake.intakeNumber,
    startDate: intake.startDate,
    endDate: intake.endDate,
    year: intake.year,
  });

  await ensureProgressTestsTable();

  const [roster, marks] = await Promise.all([
    db
      .select({
        enrollmentId: enrollments.enrollmentId,
        armyNumber: students.armyNumber,
        rank: enrollments.rankAtEnrollment,
        fullName: students.fullName,
        unit: enrollments.unitAtEnrollment,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
      .where(
        and(
          eq(enrollments.intakeId, intakeId),
          ne(enrollments.status, "withdrawn")
        )
      ),
    db
      .select({
        enrollmentId: progressTests.enrollmentId,
        kind: progressTests.kind,
        period: progressTests.period,
        marks: progressTests.marks,
      })
      .from(progressTests)
      .innerJoin(enrollments, eq(progressTests.enrollmentId, enrollments.enrollmentId))
      .where(eq(enrollments.intakeId, intakeId)),
  ]);

  const namedRoster = roster.map((student) => ({
    ...student,
    fullName: displayName(student.fullName, intake.courseCode, intake.courseName),
  }));
  namedRoster.sort((a, b) => {
    const byRank = rankSeniority(b.rank) - rankSeniority(a.rank);
    if (byRank !== 0) return byRank;
    return a.fullName.localeCompare(b.fullName);
  });

  const initialMarks: Record<string, string> = {};
  for (const mark of marks) {
    if (mark.kind !== "week" && mark.kind !== "month") continue;
    initialMarks[
      progressCellKey(mark.enrollmentId, mark.kind as ProgressKind, mark.period)
    ] = Number(mark.marks).toFixed(1);
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
      <PageHeader
        title={`${meta.label} · ${intakeLabel}`}
        description={`${intake.courseName} · progress chart · ${formatDatePeriod(intake.startDate, intake.endDate)}`}
      >
        <BackButton fallbackHref="/weekly" />
      </PageHeader>
      </div>
      {canEdit && (
        <ProgressImport
          intakeId={intake.intakeId}
          filename={`${meta.label} ${intakeLabel} progress`}
          rows={[
            [
              "S/NO",
              "ARMY NO",
              "RANK",
              "FULL NAME",
              "UNIT",
              ...columns.map((column) => column.label),
            ],
            ...namedRoster.map((student, index) => [
              index + 1,
              student.armyNumber,
              student.rank,
              student.fullName,
              student.unit ?? "",
              ...columns.map(
                (column) =>
                  initialMarks[
                    progressCellKey(student.enrollmentId, column.kind, column.period)
                  ] ?? ""
              ),
            ]),
          ]}
        />
      )}
      <ProgressChart
        intakeId={intake.intakeId}
        title={`${meta.label} ${intakeLabel}`}
        fromLabel={formatDateOnly(intake.startDate, "medium")}
        toLabel={formatDateOnly(intake.endDate, "medium")}
        columns={columns}
        students={namedRoster}
        initialMarks={initialMarks}
        canEdit={canEdit}
        currentWeek={status.phase === "current" ? status.week : 0}
        currentMonth={
          status.phase === "current"
            ? currentTrainingMonth(status.week, monthCount, status.phase)
            : 0
        }
      />
    </div>
  );
}
