export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  enrollments,
  students,
  courseIntakes,
  courses,
} from "@/lib/db/schema";
import { eq, desc, or } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeBadge } from "@/components/grade-badge";
import { StatusBadge } from "@/components/status-badge";
import { ExportButtons } from "@/components/export-buttons";
import { AlertTriangle, XCircle } from "lucide-react";
import Link from "next/link";
import { studentPath } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function FailuresPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = params.year ? parseInt(params.year) : currentYear;

  // Get years for filter
  const years = await db
    .selectDistinct({ year: courseIntakes.year })
    .from(courseIntakes)
    .orderBy(desc(courseIntakes.year));

  // Get students who failed (grade F) or have status "failed"
  const failures = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      armyNumber: students.armyNumber,
      fullName: students.fullName,
      rank: enrollments.rankAtEnrollment,
      unit: enrollments.unitAtEnrollment,
      courseName: courses.courseName,
      courseCode: courses.courseCode,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      averageMarks: enrollments.averageMarks,
      grade: enrollments.grade,
      status: enrollments.status,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(
      or(eq(enrollments.grade, "F"), eq(enrollments.status, "failed"))
    )
    .orderBy(desc(courseIntakes.year), students.fullName);

  // Filter by year if selected
  const filteredFailures = selectedYear
    ? failures.filter((f) => f.year === selectedYear)
    : failures;

  // Get at-risk students (grade D or low average but not yet failed)
  const atRisk = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      armyNumber: students.armyNumber,
      fullName: students.fullName,
      rank: enrollments.rankAtEnrollment,
      unit: enrollments.unitAtEnrollment,
      courseName: courses.courseName,
      courseCode: courses.courseCode,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      averageMarks: enrollments.averageMarks,
      grade: enrollments.grade,
      status: enrollments.status,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(
      eq(enrollments.grade, "D")
    )
    .orderBy(desc(courseIntakes.year), students.fullName);

  // Filter at-risk by year
  const filteredAtRisk = selectedYear
    ? atRisk.filter((r) => r.year === selectedYear)
    : atRisk;

  const exportColumns = [
    { key: "armyNumber", header: "Army Number" },
    { key: "rank", header: "Rank" },
    { key: "fullName", header: "Full Name" },
    { key: "unit", header: "Unit" },
    { key: "courseCode", header: "Course" },
    { key: "intakeNumber", header: "Intake" },
    { key: "year", header: "Year" },
    { key: "averageMarks", header: "Average (%)" },
    { key: "grade", header: "Grade" },
    { key: "status", header: "Status" },
  ];

  const formatAvg = <T extends { averageMarks: string | null }>(rows: T[]) =>
    rows.map((r) => ({
      ...r,
      averageMarks: r.averageMarks
        ? parseFloat(r.averageMarks).toFixed(1)
        : "N/A",
    }));
  const failuresExport = formatAvg(filteredFailures);
  const atRiskExport = formatAvg(filteredAtRisk);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Failures & At-Risk"
        description="Students who failed or are at risk of failing"
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Students</CardTitle>
            <XCircle className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {filteredFailures.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Grade F or failed status in {selectedYear}
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At-Risk Students</CardTitle>
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {filteredAtRisk.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Grade D (borderline pass) in {selectedYear}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Year Filter */}
      <Card>
        <CardContent className="pt-4">
          <form className="flex items-center gap-4">
            <label className="text-sm font-medium">Filter by Year:</label>
            <select
              name="year"
              defaultValue={selectedYear}
              className="rounded border px-3 py-1.5 text-sm"
            >
              {years.map((y) => (
                <option key={y.year} value={y.year}>
                  {y.year}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Apply
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Failed Students Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base text-red-600">
              Failed Students ({selectedYear})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Students with Grade F or failed status
            </p>
          </div>
          <ExportButtons
            data={failuresExport}
            columns={exportColumns}
            filename={`failures-${selectedYear}`}
            title={`Failed Students - ${selectedYear}`}
          />
        </CardHeader>
        <CardContent>
          {filteredFailures.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No failed students in {selectedYear}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Student</th>
                    <th className="text-left py-3 px-2 font-medium">Army No.</th>
                    <th className="text-left py-3 px-2 font-medium">Unit</th>
                    <th className="text-left py-3 px-2 font-medium">Course</th>
                    <th className="text-left py-3 px-2 font-medium">Intake</th>
                    <th className="text-left py-3 px-2 font-medium">Average</th>
                    <th className="text-left py-3 px-2 font-medium">Grade</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFailures.map((row) => (
                    <tr key={row.enrollmentId} className="border-b">
                      <td className="py-3 px-2">
                        <Link
                          href={studentPath(row.armyNumber)}
                          className="hover:underline font-medium"
                        >
                          {row.rank} {row.fullName}
                        </Link>
                      </td>
                      <td className="py-3 px-2 font-mono text-sm">
                        {row.armyNumber}
                      </td>
                      <td className="py-3 px-2">{row.unit ?? "—"}</td>
                      <td className="py-3 px-2">
                        <span className="font-mono text-sm">{row.courseCode}</span>
                      </td>
                      <td className="py-3 px-2">{row.intakeNumber}</td>
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

      {/* At-Risk Students Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base text-orange-600">
              At-Risk Students ({selectedYear})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Students with Grade D (borderline pass)
            </p>
          </div>
          <ExportButtons
            data={atRiskExport}
            columns={exportColumns}
            filename={`at-risk-${selectedYear}`}
            title={`At-Risk Students - ${selectedYear}`}
          />
        </CardHeader>
        <CardContent>
          {filteredAtRisk.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No at-risk students in {selectedYear}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Student</th>
                    <th className="text-left py-3 px-2 font-medium">Army No.</th>
                    <th className="text-left py-3 px-2 font-medium">Unit</th>
                    <th className="text-left py-3 px-2 font-medium">Course</th>
                    <th className="text-left py-3 px-2 font-medium">Intake</th>
                    <th className="text-left py-3 px-2 font-medium">Average</th>
                    <th className="text-left py-3 px-2 font-medium">Grade</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAtRisk.map((row) => (
                    <tr key={row.enrollmentId} className="border-b">
                      <td className="py-3 px-2">
                        <Link
                          href={studentPath(row.armyNumber)}
                          className="hover:underline font-medium"
                        >
                          {row.rank} {row.fullName}
                        </Link>
                      </td>
                      <td className="py-3 px-2 font-mono text-sm">
                        {row.armyNumber}
                      </td>
                      <td className="py-3 px-2">{row.unit ?? "—"}</td>
                      <td className="py-3 px-2">
                        <span className="font-mono text-sm">{row.courseCode}</span>
                      </td>
                      <td className="py-3 px-2">{row.intakeNumber}</td>
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
    </div>
  );
}
