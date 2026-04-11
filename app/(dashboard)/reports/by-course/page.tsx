export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  courses,
  courseIntakes,
  enrollments,
  students,
} from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GradeBadge } from "@/components/grade-badge";
import { PositionBadge } from "@/components/position-badge";
import { StatusBadge } from "@/components/status-badge";
import { ExportButtons } from "@/components/export-buttons";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ courseId?: string; intakeId?: string; year?: string }>;
}

const ALL = "__all__";

export default async function ByCourseReportPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = {
    courseId: raw.courseId && raw.courseId !== ALL ? raw.courseId : undefined,
    intakeId: raw.intakeId && raw.intakeId !== ALL ? raw.intakeId : undefined,
    year: raw.year && raw.year !== ALL ? raw.year : undefined,
  };

  // Get all courses for filter
  const allCourses = await db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(courses)
    .where(eq(courses.isActive, true))
    .orderBy(courses.courseCode);

  // Get years for filter
  const years = await db
    .selectDistinct({ year: courseIntakes.year })
    .from(courseIntakes)
    .orderBy(desc(courseIntakes.year));

  // Get intakes for selected course/year
  let intakesQuery = db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      courseId: courseIntakes.courseId,
    })
    .from(courseIntakes)
    .orderBy(desc(courseIntakes.year), courseIntakes.intakeNumber);

  let intakes = await intakesQuery;

  if (params.courseId) {
    intakes = intakes.filter((i) => i.courseId === parseInt(params.courseId!));
  }
  if (params.year) {
    intakes = intakes.filter((i) => i.year === parseInt(params.year!));
  }

  // Get report data if intake is selected
  let reportData: Array<{
    enrollmentId: number;
    armyNumber: string;
    fullName: string;
    rank: string;
    unit: string | null;
    status: string;
    averageMarks: string | null;
    grade: string | null;
    position: number | null;
  }> = [];

  let selectedIntake: {
    intakeNumber: string;
    year: number;
    courseName: string;
    courseCode: string;
  } | null = null;

  if (params.intakeId) {
    const intakeId = parseInt(params.intakeId);

    // Get intake info
    const [intakeInfo] = await db
      .select({
        intakeNumber: courseIntakes.intakeNumber,
        year: courseIntakes.year,
        courseName: courses.courseName,
        courseCode: courses.courseCode,
      })
      .from(courseIntakes)
      .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
      .where(eq(courseIntakes.intakeId, intakeId))
      .limit(1);

    selectedIntake = intakeInfo;

    // Get enrollments for this intake
    reportData = await db
      .select({
        enrollmentId: enrollments.enrollmentId,
        armyNumber: students.armyNumber,
        fullName: students.fullName,
        rank: students.rank,
        unit: students.unit,
        status: enrollments.status,
        averageMarks: enrollments.averageMarks,
        grade: enrollments.grade,
        position: enrollments.position,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
      .where(eq(enrollments.intakeId, intakeId))
      .orderBy(enrollments.position);
  }

  const exportColumns = [
    { key: "position", header: "Position" },
    { key: "armyNumber", header: "Army Number" },
    { key: "rank", header: "Rank" },
    { key: "fullName", header: "Full Name" },
    { key: "unit", header: "Unit" },
    { key: "averageMarks", header: "Average (%)" },
    { key: "grade", header: "Grade" },
    { key: "status", header: "Status" },
  ];

  const exportData = reportData.map((r) => ({
    ...r,
    averageMarks: r.averageMarks
      ? parseFloat(r.averageMarks).toFixed(1)
      : "N/A",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report by Course"
        description="View performance by course and intake"
      />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Course</label>
              <Select name="courseId" defaultValue={params.courseId ?? ALL}>
                <SelectTrigger>
                  <SelectValue placeholder="All courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All courses</SelectItem>
                  {allCourses.map((c) => (
                    <SelectItem key={c.courseId} value={c.courseId.toString()}>
                      {c.courseCode} - {c.courseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Year</label>
              <Select name="year" defaultValue={params.year ?? ALL}>
                <SelectTrigger>
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All years</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y.year} value={y.year.toString()}>
                      {y.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Intake</label>
              <Select name="intakeId" defaultValue={params.intakeId ?? ALL}>
                <SelectTrigger>
                  <SelectValue placeholder="Select intake" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Select intake</SelectItem>
                  {intakes.map((i) => (
                    <SelectItem key={i.intakeId} value={i.intakeId.toString()}>
                      {i.intakeNumber} ({i.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3 flex gap-2">
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Apply Filters
              </button>
              <Link
                href="/reports/by-course"
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Reset
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Report Data */}
      {selectedIntake && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                {selectedIntake.courseName} - {selectedIntake.intakeNumber}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedIntake.courseCode} ({selectedIntake.year})
              </p>
            </div>
            <ExportButtons
              data={exportData}
              columns={exportColumns}
              filename={`report-${selectedIntake.courseCode}-${selectedIntake.intakeNumber}`}
              title={`${selectedIntake.courseName} - ${selectedIntake.intakeNumber} (${selectedIntake.year})`}
            />
          </CardHeader>
          <CardContent>
            {reportData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No students enrolled in this intake.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Position</th>
                      <th className="text-left py-3 px-2 font-medium">Army No.</th>
                      <th className="text-left py-3 px-2 font-medium">Student</th>
                      <th className="text-left py-3 px-2 font-medium">Unit</th>
                      <th className="text-left py-3 px-2 font-medium">Average</th>
                      <th className="text-left py-3 px-2 font-medium">Grade</th>
                      <th className="text-left py-3 px-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row) => (
                      <tr key={row.enrollmentId} className="border-b">
                        <td className="py-3 px-2">
                          <PositionBadge position={row.position} />
                        </td>
                        <td className="py-3 px-2 font-mono text-sm">
                          {row.armyNumber}
                        </td>
                        <td className="py-3 px-2">
                          <Link
                            href={`/students/${row.armyNumber}`}
                            className="hover:underline"
                          >
                            {row.rank} {row.fullName}
                          </Link>
                        </td>
                        <td className="py-3 px-2">{row.unit ?? "—"}</td>
                        <td className="py-3 px-2">
                          {row.averageMarks
                            ? `${parseFloat(row.averageMarks).toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="py-3 px-2">
                          <GradeBadge grade={row.grade as any} />
                        </td>
                        <td className="py-3 px-2">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
