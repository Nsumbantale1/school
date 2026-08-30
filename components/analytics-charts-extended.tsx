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
  LineChart,
  Line,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_COLORS: Record<string, string> = {
  enrolled: "#3b82f6",
  completed: "#22c55e",
  failed: "#ef4444",
  incomplete: "#f97316",
  indiscipline: "#7c3aed",
  "in progress": "#06b6d4",
  withdrawn: "#94a3b8",
};

interface StatusRow {
  status: string;
  count: number;
  percentage: number;
}

export function StatusBreakdownChart({
  data,
  title = "Enrollment Status Breakdown",
}: {
  data: StatusRow[];
  title?: string;
}) {
  const chartConfig: ChartConfig = Object.fromEntries(
    data.map((d) => [
      d.status,
      {
        label: d.status.replace(/\b\w/g, (c) => c.toUpperCase()),
        color: STATUS_COLORS[d.status] ?? "#64748b",
      },
    ])
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px]">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="status"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) =>
                String(v).replace(/\b\w/g, (c: string) => c.toUpperCase())
              }
            />
            <YAxis allowDecimals={false} />
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(value, _name, props) => [
                `${value} (${props.payload.percentage}%)`,
                "Count",
              ]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.status}
                  fill={STATUS_COLORS[entry.status] ?? "#64748b"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface TrendRow {
  year: number;
  passRate: number;
  failed: number;
}

export function PassRateTrendChart({
  data,
  title = "Pass Rate Trend (5 Years)",
}: {
  data: TrendRow[];
  title?: string;
}) {
  const chartConfig: ChartConfig = {
    passRate: { label: "Pass Rate (%)", color: "#22c55e" },
    failed: { label: "Failed", color: "#ef4444" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px]">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis yAxisId="left" domain={[0, 100]} />
            <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="passRate"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="failed"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface SubjectRow {
  subjectName: string;
  avgPercentage: number;
  passRate: number;
  attempts: number;
}

export function SubjectAnalysisChart({
  data,
  title = "Subject Average Scores",
}: {
  data: SubjectRow[];
  title?: string;
}) {
  const chartConfig: ChartConfig = {
    avgPercentage: { label: "Avg %", color: "#8b5cf6" },
  };

  const chartData = data.slice(0, 10).map((s) => ({
    ...s,
    shortName:
      s.subjectName.length > 22
        ? `${s.subjectName.slice(0, 20)}…`
        : s.subjectName,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center text-muted-foreground">
          No subject data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[320px]">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis dataKey="shortName" type="category" width={120} tick={{ fontSize: 10 }} />
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(value, _name, props) => [
                `${value}% pass: ${props.payload.passRate}%`,
                props.payload.subjectName,
              ]}
            />
            <Bar dataKey="avgPercentage" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
