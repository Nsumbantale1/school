"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ComparisonMetrics,
  ComparisonResult,
} from "@/lib/utils/comparative-analytics";

function MetricCard({
  title,
  valueA,
  valueB,
  labelA,
  labelB,
  suffix = "",
}: {
  title: string;
  valueA: string | number;
  valueB: string | number;
  labelA: string;
  labelB: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground truncate">{labelA}</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {valueA}
              {suffix}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground truncate">{labelB}</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {valueB}
              {suffix}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SideSummary({ side }: { side: ComparisonMetrics }) {
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <p className="font-semibold">{side.label}</p>
      <p className="text-sm text-muted-foreground">{side.subtitle}</p>
    </div>
  );
}

export function ComparativeCharts({
  comparison,
}: {
  comparison: ComparisonResult;
}) {
  const { sideA, sideB } = comparison;

  const enrollmentData = [
    {
      metric: "Total",
      A: sideA.totalEnrollments,
      B: sideB.totalEnrollments,
    },
    { metric: "Completed", A: sideA.completed, B: sideB.completed },
    { metric: "Failed", A: sideA.failed, B: sideB.failed },
    { metric: "Active", A: sideA.active, B: sideB.active },
    {
      metric: "Incomplete",
      A: sideA.incomplete,
      B: sideB.incomplete,
    },
    {
      metric: "Indiscipline",
      A: sideA.indiscipline,
      B: sideB.indiscipline,
    },
  ];

  const gradeData = ["A", "B", "C", "D", "F"].map((grade) => ({
    grade,
    A: sideA.grades.find((g) => g.grade === grade)?.count ?? 0,
    B: sideB.grades.find((g) => g.grade === grade)?.count ?? 0,
  }));

  const chartConfig: ChartConfig = {
    A: { label: sideA.label, color: "#3b82f6" },
    B: { label: sideB.label, color: "#22c55e" },
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <SideSummary side={sideA} />
        <SideSummary side={sideB} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Pass Rate"
          valueA={sideA.passRate}
          valueB={sideB.passRate}
          labelA={sideA.label}
          labelB={sideB.label}
          suffix="%"
        />
        <MetricCard
          title="Average Score"
          valueA={sideA.avgScore ?? "—"}
          valueB={sideB.avgScore ?? "—"}
          labelA={sideA.label}
          labelB={sideB.label}
        />
        <MetricCard
          title="Total Enrollments"
          valueA={sideA.totalEnrollments}
          valueB={sideB.totalEnrollments}
          labelA={sideA.label}
          labelB={sideB.label}
        />
        <MetricCard
          title="Completed"
          valueA={sideA.completed}
          valueB={sideB.completed}
          labelA={sideA.label}
          labelB={sideB.label}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrollment breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px]">
              <BarChart data={enrollmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="A" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="B" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px]">
              <BarChart data={gradeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grade" />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="A" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="B" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Side-by-side summary</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Metric</th>
                <th className="py-2 pr-4 text-blue-600 dark:text-blue-400">
                  {sideA.label}
                </th>
                <th className="py-2 text-green-600 dark:text-green-400">
                  {sideB.label}
                </th>
                <th className="py-2 pl-4">Difference</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Pass rate", `${sideA.passRate}%`, `${sideB.passRate}%`, sideB.passRate - sideA.passRate, "%"],
                ["Avg score", sideA.avgScore ?? "—", sideB.avgScore ?? "—", (sideB.avgScore ?? 0) - (sideA.avgScore ?? 0), ""],
                ["Enrollments", sideA.totalEnrollments, sideB.totalEnrollments, sideB.totalEnrollments - sideA.totalEnrollments, ""],
                ["Completed", sideA.completed, sideB.completed, sideB.completed - sideA.completed, ""],
                ["Failed", sideA.failed, sideB.failed, sideB.failed - sideA.failed, ""],
                ["Grade A", sideA.grades.find(g => g.grade === "A")?.count ?? 0, sideB.grades.find(g => g.grade === "A")?.count ?? 0, (sideB.grades.find(g => g.grade === "A")?.count ?? 0) - (sideA.grades.find(g => g.grade === "A")?.count ?? 0), ""],
              ].map(([metric, a, b, diff, suffix]) => (
                <tr key={String(metric)} className="border-b">
                  <td className="py-2 pr-4 font-medium">{metric}</td>
                  <td className="py-2 pr-4">{a}</td>
                  <td className="py-2">{b}</td>
                  <td className="py-2 pl-4">
                    {typeof diff === "number" && diff > 0 ? "+" : ""}
                    {diff}
                    {suffix}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
