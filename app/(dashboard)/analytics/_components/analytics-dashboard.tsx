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
import type { AnalyticsDashboardData } from "@/lib/utils/analytics-data";

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

const SECTIONS = [
  { id: "year", index: "01", title: "Year against year" },
  { id: "grades", index: "02", title: "Grade against grade" },
  { id: "courses", index: "03", title: "Course against course" },
  { id: "intakes", index: "04", title: "Intake against intake" },
  { id: "subjects", index: "05", title: "Subject against subject" },
] as const;

function rateClass(rate: number) {
  if (rate >= 75) return "text-green-700 dark:text-green-400";
  if (rate >= 55) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

function openingBrief(data: AnalyticsDashboardData) {
  const enrollments = data.kpis.totalEnrollments.value;
  const pass = data.kpis.passRate.value;
  const change = data.kpis.passRate.change;
  if (enrollments === 0) {
    return {
      headline: "No enrollments in this scope",
      detail:
        "Choose another year or course. Leave both filters on All to read the full training record.",
    };
  }

  const movement =
    change == null
      ? "The previous year has no pass rate to compare."
      : change === 0
        ? "The pass rate is level with the previous year."
        : `The pass rate is ${Math.abs(change)}% ${change > 0 ? "higher" : "lower"} than the previous year.`;

  const lead = [...data.coursePerformance].sort((a, b) => b.passRate - a.passRate)[0];
  const hardest = data.subjectAnalysis[0];
  const notes = [
    movement,
    lead
      ? `${lead.courseCode} is the strongest course in this scope, at ${lead.passRate}% pass rate.`
      : "",
    hardest
      ? `${hardest.subjectName} is the lowest-scoring subject, at ${hardest.avgPercentage}%.`
      : "",
  ].filter(Boolean);

  return {
    headline: `${pass}% pass rate across ${enrollments.toLocaleString()} enrollments`,
    detail: notes.join(" "),
  };
}

function OutcomeCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function SectionHeading({
  index,
  title,
  detail,
}: {
  index: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 font-mono text-xs tracking-widest text-muted-foreground">
        {index}
      </span>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
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

  const brief = openingBrief(data);

  return (
    <div className="space-y-10">
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

      <Card className="overflow-hidden">
        <CardContent className="grid gap-6 p-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
          <div className="space-y-3 p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Opening brief · {filterLabel}
            </p>
            <p className="text-2xl font-semibold tracking-tight">{brief.headline}</p>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{brief.detail}</p>
          </div>
          <div className="border-t bg-muted/40 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              This page compares
            </p>
            <ol className="mt-3 space-y-2 text-sm">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="hover:underline">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{section.index}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Outcomes in {filterLabel}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Grade A is a final grade of A. Failed is a final grade of F, or the older failed status.
            Ceased training is the CT status. Discipline cases are students who ceased training for indiscipline, counted on their own.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OutcomeCard label="Grade A" value={data.outcomes.gradeA} hint="Final grade A" />
          <OutcomeCard label="Failed" value={data.outcomes.failed} hint="Grade F or legacy failed status" />
          <OutcomeCard label="Ceased training" value={data.outcomes.ceasedTraining} hint="CT status" />
          <OutcomeCard
            label="Discipline cases"
            value={data.outcomes.discipline}
            hint="Ceased training for indiscipline"
          />
        </div>
      </div>

      <section id="year" className="scroll-mt-6 space-y-4">
        <SectionHeading
          index="01"
          title="Year against year"
          detail="The selected scope against the previous year, then the last five years beside one another. An increase in Failed or At Risk is marked in red."
        />
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
        <div className="grid gap-6 lg:grid-cols-2">
          <EnrollmentTrendChart data={data.enrollmentTrend} />
          <PassRateTrendChart data={data.enrollmentTrend} />
        </div>
        <MonthlyEnrollmentChart
          data={data.monthlyEnrollments.map((m) => ({
            month: m.month,
            count: m.enrollments,
          }))}
          title={`Monthly enrollments (${data.filters.selectedYear ?? new Date().getFullYear()})`}
        />
      </section>

      <section id="grades" className="scroll-mt-6 space-y-4">
        <SectionHeading
          index="02"
          title="Grade against grade"
          detail="Final grades A to F among students who completed, set beside the enrollment statuses in the same scope: completed, failed, incomplete, indiscipline, and still in training."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <GradeDistributionChart data={data.gradeDistribution} title="Final grade against final grade" />
          <StatusBreakdownChart data={data.statusBreakdown} title="Status against status" />
        </div>
      </section>

      <section id="courses" className="scroll-mt-6 space-y-4">
        <SectionHeading
          index="03"
          title="Course against course"
          detail="Each course is measured on students who completed. Green is a pass rate of 75% or more, amber is 55% to 74%, and red is below 55%."
        />
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
              <CardTitle className="text-base">Course ranking</CardTitle>
              <CardDescription>
                Pass rate and average score, one row per course in this scope
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
                            className={cn("font-semibold", rateClass(c.passRate))}
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
      </section>

      <section id="intakes" className="scroll-mt-6 space-y-4">
        <SectionHeading
          index="04"
          title="Intake against intake"
          detail="The latest intakes in this scope, each judged by how many students finished and what share of those finishes were a pass."
        />
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Intake ranking
              </CardTitle>
              <CardDescription>
                Up to 20 intakes, newest first
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
                            className={cn("font-semibold", rateClass(i.passRate))}
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
      </section>

      <section id="subjects" className="scroll-mt-6 space-y-4">
        <SectionHeading
          index="05"
          title="Subject against subject"
          detail="Each subject is scored as marks gained divided by the maximum mark. A subject pass is 55% or higher. The list starts with the lowest average, so the hardest subject is first."
        />
          <SubjectAnalysisChart data={data.subjectAnalysis} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subject ranking</CardTitle>
              <CardDescription>
                Lowest average first, limited to 15 subjects
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
                            className={cn("font-semibold", rateClass(s.avgPercentage))}
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
      </section>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Two specific records</p>
            <p className="text-sm text-muted-foreground">
              Comparative places one intake, course, or year directly beside another.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/analytics/comparative">
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Open Comparative
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
