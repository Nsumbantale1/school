"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  progressCellKey,
  type ProgressColumn,
  type ProgressKind,
} from "@/lib/utils/progress-chart";
import { saveProgressMark } from "../actions";

export type ChartStudent = {
  enrollmentId: number;
  armyNumber: string;
  rank: string;
  fullName: string;
};

type Summary = { total: number; average: number };

const STICKY = [
  { key: "sno", label: "S/No", width: 44 },
  { key: "army", label: "Army No", width: 92 },
  { key: "rank", label: "Rank", width: 64 },
  { key: "name", label: "Full name", width: 190 },
] as const;

function formatMark(value: number): string {
  return value.toFixed(1);
}

function readMark(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function ProgressChart({
  intakeId,
  title,
  periodLabel,
  columns,
  students,
  initialMarks,
  canEdit,
  currentWeek,
  currentMonth,
}: {
  intakeId: number;
  title: string;
  periodLabel: string;
  columns: ProgressColumn[];
  students: ChartStudent[];
  initialMarks: Record<string, string>;
  canEdit: boolean;
  currentWeek: number;
  currentMonth: number;
}) {
  const [marks, setMarks] = useState(initialMarks);
  const [saved, setSaved] = useState(initialMarks);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const weekPeriods = useMemo(
    () => columns.filter((column) => column.kind === "week").map((column) => column.period),
    [columns]
  );
  const monthPeriods = useMemo(
    () => columns.filter((column) => column.kind === "month").map((column) => column.period),
    [columns]
  );

  const summaries = useMemo(() => {
    function summarize(enrollmentId: number, kind: ProgressKind, periods: number[]): Summary | null {
      const values = periods
        .map((period) => readMark(marks[progressCellKey(enrollmentId, kind, period)]))
        .filter((value): value is number => value != null);
      if (values.length === 0) return null;
      const total = values.reduce((sum, value) => sum + value, 0);
      return { total, average: total / values.length };
    }

    function points(kind: ProgressKind, periods: number[]) {
      const scored = students
        .map((student) => ({
          enrollmentId: student.enrollmentId,
          summary: summarize(student.enrollmentId, kind, periods),
        }))
        .filter((row): row is { enrollmentId: number; summary: Summary } => row.summary != null)
        .sort((a, b) => b.summary.average - a.summary.average);

      const positions = new Map<number, number>();
      let position = 1;
      let skip = 0;
      let last: number | null = null;
      for (const row of scored) {
        if (last != null && row.summary.average !== last) {
          position += skip;
          skip = 1;
        } else {
          skip += 1;
        }
        last = row.summary.average;
        positions.set(row.enrollmentId, position);
      }
      return positions;
    }

    return {
      weekly: new Map(
        students.map((student) => [
          student.enrollmentId,
          summarize(student.enrollmentId, "week", weekPeriods),
        ])
      ),
      monthly: new Map(
        students.map((student) => [
          student.enrollmentId,
          summarize(student.enrollmentId, "month", monthPeriods),
        ])
      ),
      weeklyPoint: points("week", weekPeriods),
      monthlyPoint: points("month", monthPeriods),
    };
  }, [marks, monthPeriods, students, weekPeriods]);

  async function commit(
    student: ChartStudent,
    column: ProgressColumn,
    raw: string
  ) {
    const key = progressCellKey(student.enrollmentId, column.kind, column.period);
    const next = raw.trim();
    if ((saved[key] ?? "") === next) return;
    if (next !== "" && (Number.isNaN(Number(next)) || Number(next) < 0 || Number(next) > 100)) {
      toast.error("Enter a mark from 0 to 100.");
      setMarks((prev) => ({ ...prev, [key]: saved[key] ?? "" }));
      return;
    }
    setSavingKey(key);
    const result = await saveProgressMark({
      intakeId,
      enrollmentId: student.enrollmentId,
      kind: column.kind,
      period: column.period,
      marks: next,
    });
    setSavingKey(null);
    if (!result.success) {
      toast.error(result.error ?? "Could not save the mark.");
      setMarks((prev) => ({ ...prev, [key]: saved[key] ?? "" }));
      return;
    }
    const stored = next === "" ? "" : Number(next).toFixed(1);
    setMarks((prev) => ({ ...prev, [key]: stored }));
    setSaved((prev) => ({ ...prev, [key]: stored }));
  }

  const leftOf = (index: number) =>
    STICKY.slice(0, index).reduce((sum, column) => sum + column.width, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <p className="text-xs text-muted-foreground">
          Weekly tests are numbered. Monthly tests are M-1, M-2, and so on, after every three weeks.
          {canEdit ? " Click a cell to enter a mark out of 100." : " View only."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print chart
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card print:overflow-visible">
        <table className="border-collapse text-xs">
          <thead>
            <tr className="bg-[#1a5c2e] text-white">
              <th
                colSpan={4}
                className="border border-[#1a5c2e] px-2 py-2 text-left text-[11px] font-semibold tracking-wide"
              >
                <div>{title}</div>
                <div className="font-normal text-white/80">{periodLabel}</div>
              </th>
              <th
                colSpan={columns.length}
                className="border border-white/20 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em]"
              >
                Weekly & monthly tests
              </th>
              <th colSpan={3} className="border border-white/20 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide">
                Weekly test
              </th>
              {monthPeriods.length > 0 && (
                <th colSpan={3} className="border border-white/20 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide">
                  Monthly test
                </th>
              )}
            </tr>
            <tr className="bg-muted/70 text-[10px] uppercase tracking-wide text-muted-foreground">
              {STICKY.map((column, index) => (
                <th
                  key={column.key}
                  className="sticky z-20 border bg-muted px-1.5 py-2 text-left font-semibold"
                  style={{ left: leftOf(index), minWidth: column.width, width: column.width }}
                >
                  {column.label}
                </th>
              ))}
              {columns.map((column) => {
                const current =
                  (column.kind === "week" && column.period === currentWeek) ||
                  (column.kind === "month" && column.period === currentMonth);
                return (
                  <th
                    key={column.key}
                    className={cn(
                      "border px-1 py-2 text-center font-semibold",
                      column.kind === "month" && "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
                      current && "ring-2 ring-inset ring-primary"
                    )}
                    style={{ minWidth: column.kind === "month" ? 52 : 46 }}
                  >
                    {column.label}
                  </th>
                );
              })}
              {["Total", "Average", "Point"].map((label) => (
                <th key={`w-${label}`} className="border bg-muted px-1.5 py-2 text-center font-semibold" style={{ minWidth: 64 }}>
                  {label}
                </th>
              ))}
              {monthPeriods.length > 0 &&
                ["Total", "Average", "Point"].map((label) => (
                  <th key={`m-${label}`} className="border bg-amber-50 px-1.5 py-2 text-center font-semibold dark:bg-amber-950/30" style={{ minWidth: 64 }}>
                    {label}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={4 + columns.length + 6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No students are enrolled on this intake.
                </td>
              </tr>
            ) : (
              students.map((student, index) => {
                const weekly = summaries.weekly.get(student.enrollmentId);
                const monthly = summaries.monthly.get(student.enrollmentId);
                return (
                  <tr key={student.enrollmentId} className="odd:bg-background even:bg-muted/20">
                    <td
                      className="sticky z-10 border bg-card px-1.5 py-1 text-center tabular-nums"
                      style={{ left: leftOf(0), minWidth: STICKY[0].width }}
                    >
                      {index + 1}
                    </td>
                    <td
                      className="sticky z-10 border bg-card px-1.5 py-1 font-mono"
                      style={{ left: leftOf(1), minWidth: STICKY[1].width }}
                    >
                      {student.armyNumber}
                    </td>
                    <td
                      className="sticky z-10 border bg-card px-1.5 py-1"
                      style={{ left: leftOf(2), minWidth: STICKY[2].width }}
                    >
                      {student.rank}
                    </td>
                    <td
                      className="sticky z-10 border bg-card px-1.5 py-1 font-medium"
                      style={{ left: leftOf(3), minWidth: STICKY[3].width }}
                    >
                      {student.fullName}
                    </td>
                    {columns.map((column) => {
                      const key = progressCellKey(student.enrollmentId, column.kind, column.period);
                      const current =
                        (column.kind === "week" && column.period === currentWeek) ||
                        (column.kind === "month" && column.period === currentMonth);
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            "border p-0 text-center",
                            column.kind === "month" && "bg-amber-50/80 dark:bg-amber-950/20",
                            current && "bg-primary/5"
                          )}
                        >
                          <input
                            value={marks[key] ?? ""}
                            disabled={!canEdit || savingKey === key}
                            inputMode="decimal"
                            aria-label={`${student.fullName} ${column.label}`}
                            onChange={(event) =>
                              setMarks((prev) => ({ ...prev, [key]: event.target.value }))
                            }
                            onBlur={(event) => void commit(student, column, event.target.value)}
                            className="h-8 w-full bg-transparent px-1 text-center tabular-nums outline-none focus:bg-background focus:ring-2 focus:ring-inset focus:ring-primary disabled:opacity-80"
                          />
                        </td>
                      );
                    })}
                    <SummaryCells summary={weekly ?? null} point={summaries.weeklyPoint.get(student.enrollmentId)} />
                    {monthPeriods.length > 0 && (
                      <SummaryCells
                        summary={monthly ?? null}
                        point={summaries.monthlyPoint.get(student.enrollmentId)}
                        monthly
                      />
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCells({
  summary,
  point,
  monthly = false,
}: {
  summary: Summary | null;
  point: number | undefined;
  monthly?: boolean;
}) {
  const className = cn(
    "border px-1.5 py-1 text-center font-medium tabular-nums",
    monthly && "bg-amber-50/80 dark:bg-amber-950/20"
  );
  return (
    <>
      <td className={className}>{summary ? formatMark(summary.total) : ""}</td>
      <td className={className}>{summary ? formatMark(summary.average) : ""}</td>
      <td className={className}>{point ?? ""}</td>
    </>
  );
}
