"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
  GraduationCap,
  Target,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GradeDistributionChart,
  EnrollmentTrendChart,
  CoursePerformanceChart,
  MonthlyEnrollmentChart,
} from "@/components/analytics-charts";
import {
  StatusBreakdownChart,
  PassRateTrendChart,
  SubjectAnalysisChart,
} from "@/components/analytics-charts-extended";
import { cn } from "@/lib/utils";

const ALL = "__all__";

function KpiCard({
  label,
  value,
  suffix = "",
  change,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: number;
  suffix?: string;
  change?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "danger" | "success";
}) {
  const TrendIcon =
    change === null || change === undefined
      ? Minus
      : change > 0
        ? TrendingUp
        : change < 0
          ? TrendingDown
          : Minus;

  const trendColor =
    change === null || change === undefined || change === 0
      ? "text-muted-foreground"
      : variant === "danger"
        ? change > 0
          ? "text-red-600"
          : "text-green-600"
        : change > 0
          ? "text-green-600"
          : "text-red-600";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value.toLocaleString()}
          {suffix}
        </div>
        {change !== undefined && change !== null && (
          <p className={cn("text-xs flex items-center gap-1 mt-1", trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {change > 0 ? "+" : ""}
            {change}% vs last year
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsDashboard({ data }: { data: AnalyticsDashboardData }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setFilter(key: "year" | "course", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete(key);
    else params.set(key, value);
    router.push(`/analytics?${params.toString()}`);
  }

  const yearValue = data.filters.selectedYear
    ? String(data.filters.selectedYear)
    : ALL;
  const courseValue = data.filters.selectedCourseId
    ? String(data.filters.selectedCourseId)
    : ALL;

  const filterLabel = [
    data.filters.selectedYear ? `Year ${data.filters.selectedYear}` : "All years",
    data.filters.selectedCourseId
      ? data.filters.courses.find((c) => c.courseId === data.filters.selectedCourseId)
          ?.courseCode
      : "All courses",
  ].join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-3">
          <Select value={yearValue} onValueChange={(v) => setFilter("year", v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All years</SelectItem>
              {data.filters.years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={courseValue} onValueChange={(v) => setFilter("course", v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All courses</SelectItem>
              {data.filters.courses.map((c) => (
                <SelectItem key={c.courseId} value={String(c.courseId)}>
                  {c.courseCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/analytics/comparative">
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Comparative Analysis
          </Link>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing analytics for: <span className="font-medium text-foreground">{filterLabel}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <KpiCard
          label={data.kpis.totalStudents.label}
          value={data.kpis.totalStudents.value}
          icon={Users}
        />
        <KpiCard
          label={data.kpis.totalEnrollments.label}
          value={data.kpis.totalEnrollments.value}
          change={data.kpis.totalEnrollments.change}
          icon={Layers}
        />
        <KpiCard
          label={data.kpis.completed.label}
          value={data.kpis.completed.value}
          change={data.kpis.completed.change}
          icon={GraduationCap}
          variant="success"
        />
        <KpiCard
          label={data.kpis.passRate.label}
          value={data.kpis.passRate.value}
          suffix="%"
          change={data.kpis.passRate.change}
          icon={Target}
          variant="success"
        />
        <KpiCard
          label={data.kpis.avgScore.label}
          value={data.kpis.avgScore.value}
          suffix="%"
          change={data.kpis.avgScore.change}
          icon={BarChart3}
        />
        <KpiCard
          label={data.kpis.failed.label}
          value={data.kpis.failed.value}
          change={data.kpis.failed.change}
          icon={AlertTriangle}
          variant="danger"
        />
        <KpiCard
          label={data.kpis.atRisk.label}
          value={data.kpis.atRisk.value}
          change={data.kpis.atRisk.change}
          icon={AlertTriangle}
          variant="danger"
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Course Performance</TabsTrigger>
          <TabsTrigger value="intakes">Intake Analysis</TabsTrigger>
          <TabsTrigger value="subjects">Subject Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <GradeDistributionChart data={data.gradeDistribution} />
            <StatusBreakdownChart data={data.statusBreakdown} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <EnrollmentTrendChart data={data.enrollmentTrend} />
            <PassRateTrendChart data={data.enrollmentTrend} />
          </div>
          <MonthlyEnrollmentChart
            data={data.monthlyEnrollments.map((m) => ({
              month: m.month,
              count: m.enrollments,
            }))}
            title={`Monthly Enrollments (${data.filters.selectedYear ?? new Date().getFullYear()})`}
          />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <CoursePerformanceChart
            data={data.coursePerformance.map((c) => ({
              courseCode: c.courseCode,
              courseName: c.courseName,
              passRate: c.passRate,
              averageScore: c.avgScore ?? 0,
            }))}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Course performance table</CardTitle>
              <CardDescription>
                Detailed pass rates and average scores per course
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Course</th>
                    <th className="py-2 pr-4">Completed</th>
                    <th className="py-2 pr-4">Passed</th>
                    <th className="py-2 pr-4">Failed</th>
                    <th className="py-2 pr-4">Pass Rate</th>
                    <th className="py-2">Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coursePerformance.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No completed enrollments for this filter.
                      </td>
                    </tr>
                  ) : (
                    data.coursePerformance.map((c) => (
                      <tr key={c.courseId} className="border-b">
                        <td className="py-2.5 pr-4">
                          <p className="font-medium">{c.courseCode}</p>
                          <p className="text-xs text-muted-foreground">{c.courseName}</p>
                        </td>
                        <td className="py-2.5 pr-4">{c.completed}</td>
                        <td className="py-2.5 pr-4 text-green-700 dark:text-green-400">
                          {c.passed}
                        </td>
                        <td className="py-2.5 pr-4 text-red-700 dark:text-red-400">
                          {c.failed}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={cn(
                              "font-semibold",
                              c.passRate >= 75
                                ? "text-green-700 dark:text-green-400"
                                : c.passRate >= 55
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-red-700 dark:text-red-400"
                            )}
                          >
                            {c.passRate}%
                          </span>
                        </td>
                        <td className="py-2.5">
                          {c.avgScore !== null ? `${c.avgScore}%` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intakes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Intake performance
              </CardTitle>
              <CardDescription>
                Compare outcomes across intakes — pass rate and average score
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Intake</th>
                    <th className="py-2 pr-4">Course</th>
                    <th className="py-2 pr-4">Year</th>
                    <th className="py-2 pr-4">Students</th>
                    <th className="py-2 pr-4">Completed</th>
                    <th className="py-2 pr-4">Pass Rate</th>
                    <th className="py-2">Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.intakePerformance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No intake data for this filter.
                      </td>
                    </tr>
                  ) : (
                    data.intakePerformance.map((i) => (
                      <tr key={i.intakeId} className="border-b">
                        <td className="py-2.5 pr-4 font-medium">{i.intakeNumber}</td>
                        <td className="py-2.5 pr-4">{i.courseCode}</td>
                        <td className="py-2.5 pr-4">{i.year}</td>
                        <td className="py-2.5 pr-4">{i.total}</td>
                        <td className="py-2.5 pr-4">{i.completed}</td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={cn(
                              "font-semibold",
                              i.passRate >= 75
                                ? "text-green-700"
                                : i.passRate >= 55
                                  ? "text-amber-700"
                                  : "text-red-700"
                            )}
                          >
                            {i.passRate}%
                          </span>
                        </td>
                        <td className="py-2.5">
                          {i.avgScore !== null ? `${i.avgScore}%` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-6">
          <SubjectAnalysisChart data={data.subjectAnalysis} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subject difficulty ranking</CardTitle>
              <CardDescription>
                Subjects sorted by average marks (lowest first = most challenging)
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Subject</th>
                    <th className="py-2 pr-4">Attempts</th>
                    <th className="py-2 pr-4">Avg %</th>
                    <th className="py-2">Pass Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subjectAnalysis.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No subject results for this filter.
                      </td>
                    </tr>
                  ) : (
                    data.subjectAnalysis.map((s, idx) => (
                      <tr key={s.subjectName} className="border-b">
                        <td className="py-2.5 pr-4 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2.5 pr-4 font-medium">{s.subjectName}</td>
                        <td className="py-2.5 pr-4">{s.attempts}</td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={cn(
                              "font-semibold",
                              s.avgPercentage >= 75
                                ? "text-green-700"
                                : s.avgPercentage >= 55
                                  ? "text-amber-700"
                                  : "text-red-700"
                            )}
                          >
                            {s.avgPercentage}%
                          </span>
                        </td>
                        <td className="py-2.5">{s.passRate}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
