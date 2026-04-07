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
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Grade distribution colors
const GRADE_COLORS = {
  A: "#22c55e", // green
  B: "#3b82f6", // blue
  C: "#eab308", // yellow
  D: "#f97316", // orange
  F: "#ef4444", // red
};

interface GradeDistributionData {
  grade: string;
  count: number;
  percentage: number;
}

interface GradeDistributionChartProps {
  data: GradeDistributionData[];
  title?: string;
}

export function GradeDistributionChart({
  data,
  title = "Grade Distribution",
}: GradeDistributionChartProps) {
  const chartConfig: ChartConfig = {
    A: { label: "Grade A", color: GRADE_COLORS.A },
    B: { label: "Grade B", color: GRADE_COLORS.B },
    C: { label: "Grade C", color: GRADE_COLORS.C },
    D: { label: "Grade D", color: GRADE_COLORS.D },
    F: { label: "Grade F", color: GRADE_COLORS.F },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px]">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="grade"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ grade, percentage }) =>
                `${grade}: ${percentage.toFixed(1)}%`
              }
            >
              {data.map((entry) => (
                <Cell
                  key={entry.grade}
                  fill={GRADE_COLORS[entry.grade as keyof typeof GRADE_COLORS]}
                />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent nameKey="grade" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface EnrollmentTrendData {
  year: number;
  enrollments: number;
  completions: number;
}

interface EnrollmentTrendChartProps {
  data: EnrollmentTrendData[];
  title?: string;
}

export function EnrollmentTrendChart({
  data,
  title = "Enrollment Trends (5 Years)",
}: EnrollmentTrendChartProps) {
  const chartConfig: ChartConfig = {
    enrollments: { label: "Enrollments", color: "#3b82f6" },
    completions: { label: "Completions", color: "#22c55e" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px]">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="enrollments"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="completions"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface CoursePerformanceData {
  courseName: string;
  courseCode: string;
  passRate: number;
  averageScore: number;
}

interface CoursePerformanceChartProps {
  data: CoursePerformanceData[];
  title?: string;
}

export function CoursePerformanceChart({
  data,
  title = "Course Pass Rates",
}: CoursePerformanceChartProps) {
  const chartConfig: ChartConfig = {
    passRate: { label: "Pass Rate (%)", color: "#3b82f6" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px]">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis dataKey="courseCode" type="category" width={80} />
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(value, name, props) => [
                `${value}%`,
                props.payload.courseName,
              ]}
            />
            <Bar dataKey="passRate" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface MonthlyEnrollmentData {
  month: string;
  count: number;
}

interface MonthlyEnrollmentChartProps {
  data: MonthlyEnrollmentData[];
  title?: string;
}

export function MonthlyEnrollmentChart({
  data,
  title = "Monthly Enrollments",
}: MonthlyEnrollmentChartProps) {
  const chartConfig: ChartConfig = {
    count: { label: "Enrollments", color: "#8b5cf6" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px]">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface StatsSummary {
  totalStudents: number;
  activeEnrollments: number;
  completedCourses: number;
  averagePassRate: number;
}

interface StatsOverviewProps {
  stats: StatsSummary;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalStudents}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Active Enrollments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeEnrollments}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Completed This Year
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.completedCourses}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Average Pass Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.averagePassRate}%</div>
        </CardContent>
      </Card>
    </div>
  );
}
