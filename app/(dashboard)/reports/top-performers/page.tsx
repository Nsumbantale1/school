export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  enrollments,
  students,
  courseIntakes,
  courses,
} from "@/lib/db/schema";
import { eq, desc, and, isNotNull, lte, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeBadge } from "@/components/grade-badge";
import { PositionBadge } from "@/components/position-badge";
import { ExportButtons } from "@/components/export-buttons";
import { Trophy, Medal, Award } from "lucide-react";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ year?: string; limit?: string }>;
}

export default async function TopPerformersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = params.year ? parseInt(params.year) : currentYear;
  const limit = params.limit ? parseInt(params.limit) : 20;

  // Get years for filter
  const years = await db
    .selectDistinct({ year: courseIntakes.year })
    .from(courseIntakes)
    .orderBy(desc(courseIntakes.year));

  // Get top performers - students with position 1, 2, or 3 and grade A or B
  const topPerformers = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      armyNumber: students.armyNumber,
      fullName: students.fullName,
      rank: students.rank,
      unit: students.unit,
      courseName: courses.courseName,
      courseCode: courses.courseCode,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      averageMarks: enrollments.averageMarks,
      grade: enrollments.grade,
      position: enrollments.position,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(
      and(
        eq(courseIntakes.year, selectedYear),
        isNotNull(enrollments.position),
        lte(enrollments.position, 3)
      )
    )
    .orderBy(enrollments.position, desc(enrollments.averageMarks))
    .limit(limit);

  // Export columns
  const exportColumns = [
    { key: "position", header: "Position" },
    { key: "armyNumber", header: "Army Number" },
    { key: "rank", header: "Rank" },
    { key: "fullName", header: "Full Name" },
    { key: "unit", header: "Unit" },
    { key: "courseCode", header: "Course Code" },
    { key: "courseName", header: "Course Name" },
    { key: "intakeNumber", header: "Intake" },
    {
      key: "averageMarks",
      header: "Average (%)",
      format: (v: unknown) => (v ? `${parseFloat(v as string).toFixed(1)}` : "N/A"),
    },
    { key: "grade", header: "Grade" },
  ];

  // Group by position for summary
  const firstPlace = topPerformers.filter((p) => p.position === 1).length;
  const secondPlace = topPerformers.filter((p) => p.position === 2).length;
  const thirdPlace = topPerformers.filter((p) => p.position === 3).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Top Performers"
        description="Students with highest rankings and grades"
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">1st Place</CardTitle>
            <Trophy className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{firstPlace}</div>
            <p className="text-xs text-muted-foreground">students in {selectedYear}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50 dark:bg-slate-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">2nd Place</CardTitle>
            <Medal className="h-5 w-5 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-600">{secondPlace}</div>
            <p className="text-xs text-muted-foreground">students in {selectedYear}</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">3rd Place</CardTitle>
            <Award className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{thirdPlace}</div>
            <p className="text-xs text-muted-foreground">students in {selectedYear}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Export */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Top Performers - {selectedYear}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Students ranked 1st, 2nd, or 3rd in their intakes
            </p>
          </div>
          <div className="flex items-center gap-4">
            <form className="flex items-center gap-2">
              <label className="text-sm">Year:</label>
              <select
                name="year"
                defaultValue={selectedYear}
                className="rounded border px-2 py-1 text-sm"
                onChange={(e) => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("year", e.target.value);
                  window.location.href = url.toString();
                }}
              >
                {years.map((y) => (
                  <option key={y.year} value={y.year}>
                    {y.year}
                  </option>
                ))}
              </select>
            </form>
            <ExportButtons
              data={topPerformers}
              columns={exportColumns}
              filename={`top-performers-${selectedYear}`}
              title={`Top Performers - ${selectedYear}`}
            />
          </div>
        </CardHeader>
        <CardContent>
          {topPerformers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No top performers found for {selectedYear}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Position</th>
                    <th className="text-left py-3 px-2 font-medium">Student</th>
                    <th className="text-left py-3 px-2 font-medium">Army No.</th>
                    <th className="text-left py-3 px-2 font-medium">Unit</th>
                    <th className="text-left py-3 px-2 font-medium">Course</th>
                    <th className="text-left py-3 px-2 font-medium">Intake</th>
                    <th className="text-left py-3 px-2 font-medium">Average</th>
                    <th className="text-left py-3 px-2 font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {topPerformers.map((row) => (
                    <tr key={row.enrollmentId} className="border-b">
                      <td className="py-3 px-2">
                        <PositionBadge position={row.position} />
                      </td>
                      <td className="py-3 px-2">
                        <Link
                          href={`/students/${row.armyNumber}`}
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
