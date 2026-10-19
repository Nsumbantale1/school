export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  courseIntakes,
  courses,
  enrollments,
  students,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradeBadge } from "@/components/grade-badge";
import { PositionBadge } from "@/components/position-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  Calendar,
  User,
  Users,
  Plus,
  Trophy,
  Upload,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import {
  canManageEnrollments,
  canManageResults,
  canManageIntakes,
} from "@/lib/auth/guards";
import { BackButton } from "@/components/back-button";
import { formatIntakeLabel } from "@/lib/utils/intake-label";
import { getCourseDisplayMeta } from "@/lib/utils/course-catalog";
import { displayName } from "@/lib/utils/display-name";
import { IntakeLeadershipForm } from "../_components/intake-leadership-form";
import { AddStudentsPanel } from "../_components/add-students-panel";
import { OngoingStatusControl } from "../_components/ongoing-status-control";
import { ExportButtons } from "@/components/export-buttons";
import { ImportResultsForm } from "@/app/(dashboard)/results/import/_components/import-form";
import { formatDatePeriod, weeksBetweenDates } from "@/lib/utils/format-date";

interface PageProps {
  params: Promise<{ intake_id: string }>;
}

export default async function IntakeDetailPage({ params }: PageProps) {
  const { intake_id } = await params;
  const intakeId = parseInt(intake_id, 10);
  if (!Number.isFinite(intakeId)) notFound();

  const user = await getSessionUser();
  const canEditLeadership = !!user && canManageIntakes(user.role);

  const [[intake], intakeEnrollments] = await Promise.all([
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
        courseId: courses.courseId,
        courseCode: courses.courseCode,
        courseName: courses.courseName,
        passingMark: courses.passingMark,
      })
      .from(courseIntakes)
      .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
      .where(eq(courseIntakes.intakeId, intakeId))
      .limit(1),
    db
      .select({
        enrollmentId: enrollments.enrollmentId,
        status: enrollments.status,
        ceasedAt: enrollments.ceasedAt,
        totalMarks: enrollments.totalMarks,
        averageMarks: enrollments.averageMarks,
        grade: enrollments.grade,
        position: enrollments.position,
        armyNumber: students.armyNumber,
        fullName: students.fullName,
        rank: enrollments.rankAtEnrollment,
        unit: enrollments.unitAtEnrollment,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
      .where(eq(enrollments.intakeId, intakeId))
      // Best average first; position is secondary (ties / missing averages)
      .orderBy(
        sql`${enrollments.averageMarks} DESC NULLS LAST`,
        sql`${enrollments.position} ASC NULLS LAST`,
        enrollments.studentArmyNumber
      ),
  ]);

  if (!intake) {
    notFound();
  }

  // Calculate statistics
  const totalStudents = intakeEnrollments.length;
  const completedCount = intakeEnrollments.filter(
    (e) => e.status === "completed"
  ).length;
  const passedCount = intakeEnrollments.filter(
    (e) => e.grade && e.grade !== "F"
  ).length;
  const failedCount = intakeEnrollments.filter((e) => e.grade === "F").length;

  const intakeLabel = formatIntakeLabel({
    intakeNumber: intake.intakeNumber,
    startDate: intake.startDate,
    endDate: intake.endDate,
    year: intake.year,
  });
  const courseLabel = getCourseDisplayMeta(
    intake.courseCode,
    intake.courseName
  ).label;

  const pdfColumns = [
    { key: "armyNumber", header: "Army Number" },
    { key: "rank", header: "Rank" },
    { key: "name", header: "Name" },
    { key: "unit", header: "Unit" },
    { key: "average", header: "Average" },
    { key: "grade", header: "Grade" },
    { key: "position", header: "Position" },
  ];

  const pdfData = intakeEnrollments.map((e) => ({
    armyNumber: e.armyNumber,
    rank: e.rank,
    name: displayName(e.fullName, intake.courseCode, intake.courseName),
    unit: e.unit ?? "—",
    average: e.averageMarks
      ? `${parseFloat(e.averageMarks).toFixed(1)}%`
      : "—",
    grade: e.grade ?? "—",
    position: e.position != null ? String(e.position) : "—",
  }));

  const pdfFilename = `${intake.courseCode}-${intake.intakeNumber}`.replace(
    /[^\w.-]+/g,
    "_"
  );
  const pdfTitle = `${intake.courseCode} — ${intake.courseName} · ${intakeLabel}`;
  const pdfSubtitle = [
    intake.commanderName ? `Course Comd: ${intake.commanderName}` : null,
    intake.coordinatorName ? `Coordinator: ${intake.coordinatorName}` : null,
    `Passing mark: ${intake.passingMark}%`,
    `Students: ${totalStudents}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const canImportMarks =
    !!user &&
    canManageResults(user.role) &&
    (user.role === "admin" || user.assignedCourseId === intake.courseId);

  const canAddStudents = !!user && canManageEnrollments(user.role);
  const today = new Date().toISOString().slice(0, 10);
  const courseStillOpen =
    intake.isActive && (!intake.endDate || intake.endDate >= today);
  const canSetOutcome = user?.role === "admin" && courseStillOpen;

  const intakePeriodWeeks = weeksBetweenDates(intake.startDate, intake.endDate);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${courseLabel} · ${intakeLabel}`}
        description={intake.courseName}
      >
        {canAddStudents && (
          <Button asChild>
            <Link href="#add-students">
              <Plus className="mr-2 h-4 w-4" />
              Add Students
            </Link>
          </Button>
        )}
        {canImportMarks && (
          <Button variant="outline" asChild>
            <Link href="#import-results">
              <Upload className="mr-2 h-4 w-4" />
              Import Marks
            </Link>
          </Button>
        )}
        <ExportButtons
          data={pdfData}
          columns={pdfColumns}
          filename={pdfFilename}
          title={pdfTitle}
          subtitle={pdfSubtitle}
          excelHref={`/api/intakes/${intakeId}/excel`}
        />
        <BackButton fallbackHref={`/courses/${intake.courseId}`} />
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Intake Info Cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{passedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Intake Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intake Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Course period (start – end)
                </p>
                <p>{formatDatePeriod(intake.startDate, intake.endDate)}</p>
                {intakePeriodWeeks != null && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {intakePeriodWeeks} weeks
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Course Comd</p>
                <p
                  className={
                    intake.commanderName ? "" : "text-muted-foreground italic"
                  }
                >
                  {intake.commanderName || "Not set — fill later"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Coordinator</p>
                <p
                  className={
                    intake.coordinatorName ? "" : "text-muted-foreground italic"
                  }
                >
                  {intake.coordinatorName || "Not set — fill later"}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">Passing Mark</p>
              <p className="font-medium">{intake.passingMark}%</p>
            </div>
          </CardContent>
        </Card>

        {canEditLeadership ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Course Comd &amp; Coordinator
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IntakeLeadershipForm
                intakeId={intakeId}
                commanderName={intake.commanderName}
                coordinatorName={intake.coordinatorName}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Course Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Course Code</p>
                <p className="font-mono">{intake.courseCode}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Course Name</p>
                <p>{intake.courseName}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/courses/${intake.courseId}`}>
                  View Course Details
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {canEditLeadership && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Course Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 sm:flex sm:items-end sm:justify-between sm:space-y-0">
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Course Code</p>
                <p className="font-mono">{intake.courseCode}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Course Name</p>
                <p>{intake.courseName}</p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/courses/${intake.courseId}`}>
                View Course Details
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canAddStudents && (
        <AddStudentsPanel
          intakeId={intakeId}
          intakeLabel={`${intake.courseCode} ${intakeLabel}`}
        />
      )}

      {canImportMarks && (
        <section id="import-results" className="scroll-mt-6">
          <ImportResultsForm
            intakes={[
              {
                intakeId,
                label: `${courseLabel} · ${intakeLabel}`,
              },
            ]}
            defaultIntakeId={intakeId}
            canImportOfficial={user?.role === "admin"}
            embedded
            courseLabel={courseLabel}
          />
        </section>
      )}

      {/* Enrolled Students */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Enrolled Students</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {canSetOutcome
                ? "This course is enrolled or still running. Set a student to Failed, CT, or CT for indiscipline. A cease date is required."
                : "Download Word, PDF, CSV, or Excel (all subject marks) of this course intake"}
            </p>
          </div>
          <ExportButtons
            data={pdfData}
            columns={pdfColumns}
            filename={pdfFilename}
            title={pdfTitle}
            subtitle={pdfSubtitle}
            excelHref={`/api/intakes/${intakeId}/excel`}
          />
        </CardHeader>
        <CardContent>
          {intakeEnrollments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No students enrolled yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium whitespace-nowrap">
                      Army Number
                    </th>
                    <th className="text-left py-3 pl-4 pr-8 font-medium whitespace-nowrap min-w-[5.5rem]">
                      Rank
                    </th>
                    <th className="text-left py-3 pl-8 pr-4 font-medium min-w-[12rem]">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 font-medium whitespace-nowrap">
                      Unit
                    </th>
                    <th className="text-left py-3 px-4 font-medium whitespace-nowrap">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-medium whitespace-nowrap">
                      Average
                    </th>
                    <th className="text-left py-3 px-4 font-medium whitespace-nowrap">
                      Grade
                    </th>
                    <th className="text-left py-3 px-4 font-medium whitespace-nowrap">
                      Position
                    </th>
                    {canSetOutcome && (
                      <th className="text-left py-3 px-4 font-medium whitespace-nowrap">
                        Set status
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {intakeEnrollments.map((enrollment) => (
                    <tr
                      key={enrollment.enrollmentId}
                      className="relative border-b hover:bg-muted/50"
                    >
                      <td className="py-3 px-4 font-mono text-sm whitespace-nowrap">
                        {enrollment.armyNumber}
                      </td>
                      <td className="py-3 pl-4 pr-8 font-medium whitespace-nowrap">
                        {enrollment.rank}
                      </td>
                      <td className="py-3 pl-8 pr-4">
                        <Link
                          href={`/enrollments/${enrollment.enrollmentId}`}
                          className="font-medium tracking-wide hover:underline"
                        >
                          {displayName(
                            enrollment.fullName,
                            intake.courseCode,
                            intake.courseName
                          )}
                        </Link>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {enrollment.unit ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={enrollment.status} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {enrollment.averageMarks
                          ? `${parseFloat(enrollment.averageMarks).toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <GradeBadge grade={enrollment.grade} />
                      </td>
                      <td className="py-3 px-4">
                        <PositionBadge
                          position={enrollment.position}
                          totalStudents={totalStudents}
                        />
                      </td>
                      {canSetOutcome && (
                        <td className="py-3 px-4">
                          <OngoingStatusControl
                            enrollmentId={enrollment.enrollmentId}
                            status={enrollment.status}
                            ceasedAt={
                              enrollment.ceasedAt
                                ? enrollment.ceasedAt.toISOString()
                                : null
                            }
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
