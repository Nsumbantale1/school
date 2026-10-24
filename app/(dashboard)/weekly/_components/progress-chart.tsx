"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  progressCellKey,
  type ProgressColumn,
  type ProgressKind,
} from "@/lib/utils/progress-chart";
import { examFailed, studentStanding } from "@/lib/utils/progress-standing";
import { saveProgressMark } from "../actions";

export type ChartStudent = {
  enrollmentId: number;
  armyNumber: string;
  rank: string;
  fullName: string;
  unit: string | null;
};

type Summary = { total: number; average: number };

const STICKY = [
  { key: "sno", label: "S/NO", width: 36 },
  { key: "army", label: "ARMY NO", width: 88 },
  { key: "rank", label: "RANK", width: 52 },
  { key: "name", label: "FULL NAME", width: 196 },
  { key: "unit", label: "UNIT", width: 88 },
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
  fromLabel,
  toLabel,
  columns,
  students,
  initialMarks,
  canEdit,
  canRevise,
  passMark,
  currentWeek,
  currentMonth,
}: {
  intakeId: number;
  title: string;
  fromLabel: string;
  toLabel: string;
  columns: ProgressColumn[];
  students: ChartStudent[];
  initialMarks: Record<string, string>;
  canEdit: boolean;
  /** False once marks are saved, until the Chief Instructor authorizes a correction. */
  canRevise: boolean;
  passMark: number;
  currentWeek: number;
  currentMonth: number;
}) {
  const router = useRouter();
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
    router.refresh();
  }

  const leftOf = (index: number) =>
    STICKY.slice(0, index).reduce((sum, column) => sum + column.width, 0);

  const summaryHeads = ["TOTAL MARKS", "AVERAGE", "POINT"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <p className="text-xs text-muted-foreground">
          Weeks run 1, 2, 3, then M-1, and the same after every three weeks.
          {canEdit
            ? canRevise
              ? " Click a cell to enter or correct a mark out of 100."
              : " Empty cells can still be filled. A mark that is already saved stays locked until the Chief Instructor gives authority."
            : " View only."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print chart
        </Button>
      </div>

      <div className="overflow-x-auto bg-white text-black print:overflow-visible">
        <table className="border-collapse text-[11px]">
          <thead>
            <tr>
              <th
                colSpan={STICKY.length}
                className="border border-black px-3 py-2 text-left align-bottom text-[12px] font-bold uppercase tracking-wide"
              >
                <div>Progress chart for {title} intake</div>
                <div className="mt-1 flex flex-wrap gap-x-8 font-semibold normal-case tracking-normal">
                  <span>From {fromLabel === "—" ? "………………" : fromLabel}</span>
                  <span>To {toLabel === "—" ? "………………" : toLabel}</span>
                </div>
              </th>
              <th
                colSpan={columns.length}
                className="border border-black px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.18em]"
              >
                Number of weeks
              </th>
              <th
                colSpan={3}
                className="border border-black px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.14em]"
              >
                Weekly test
              </th>
              {monthPeriods.length > 0 && (
                <th
                  colSpan={3}
                  className="border border-black px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.14em]"
                >
                  Monthly test
                </th>
              )}
            </tr>
            <tr>
              {STICKY.map((column, index) => (
                <th
                  key={column.key}
                  className="sticky z-20 border border-black bg-white px-1 py-1 align-bottom font-bold"
                  style={{ left: leftOf(index), minWidth: column.width, width: column.width, height: 118 }}
                >
                  <span className="inline-block [writing-mode:vertical-rl] rotate-180 tracking-wide">
                    {column.label}
                  </span>
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
                      "border border-black bg-white px-0.5 py-1 text-center align-bottom font-bold",
                      column.kind === "month" && "bg-neutral-100",
                      current && "outline outline-2 outline-offset-[-2px] outline-black"
                    )}
                    style={{ minWidth: column.kind === "month" ? 42 : 36, height: 118 }}
                  >
                    {column.label}
                  </th>
                );
              })}
              {summaryHeads.map((label) => (
                <th
                  key={`w-${label}`}
                  className="border border-black bg-white px-1 py-1 align-bottom font-bold"
                  style={{ minWidth: 36, height: 118 }}
                >
                  <span className="inline-block [writing-mode:vertical-rl] rotate-180 tracking-wide">
                    {label}
                  </span>
                </th>
              ))}
              {monthPeriods.length > 0 &&
                summaryHeads.map((label) => (
                  <th
                    key={`m-${label}`}
                    className="border border-black bg-neutral-100 px-1 py-1 align-bottom font-bold"
                    style={{ minWidth: 36, height: 118 }}
                  >
                    <span className="inline-block [writing-mode:vertical-rl] rotate-180 tracking-wide">
                      {label}
                    </span>
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={STICKY.length + columns.length + 6} className="border border-black px-4 py-10 text-center text-sm">
                  No students are enrolled on this intake.
                </td>
              </tr>
            ) : (
              students.map((student, index) => {
                const weekly = summaries.weekly.get(student.enrollmentId);
                const monthly = summaries.monthly.get(student.enrollmentId);
                return (
                  <tr key={student.enrollmentId}>
                    <td
                      className="sticky z-10 border border-black bg-white px-1 py-0.5 text-center tabular-nums"
                      style={{ left: leftOf(0), minWidth: STICKY[0].width }}
                    >
                      {index + 1}
                    </td>
                    <td
                      className="sticky z-10 border border-black bg-white px-1 py-0.5 font-mono"
                      style={{ left: leftOf(1), minWidth: STICKY[1].width }}
                    >
                      {student.armyNumber}
                    </td>
                    <td
                      className="sticky z-10 border border-black bg-white px-1 py-0.5"
                      style={{ left: leftOf(2), minWidth: STICKY[2].width }}
                    >
                      {student.rank}
                    </td>
                    <td
                      className="sticky z-10 border border-black bg-white px-1 py-0.5 font-medium"
                      style={{ left: leftOf(3), minWidth: STICKY[3].width }}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>{student.fullName}</span>
                        {studentStanding(columns, marks, student.enrollmentId, passMark).standing ===
                          "ct" && (
                          <span className="font-bold text-red-700">CT</span>
                        )}
                      </span>
                    </td>
                    <td
                      className="sticky z-10 border border-black bg-white px-1 py-0.5"
                      style={{ left: leftOf(4), minWidth: STICKY[4].width }}
                    >
                      {student.unit ?? ""}
                    </td>
                    {columns.map((column) => {
                      const key = progressCellKey(student.enrollmentId, column.kind, column.period);
                      const recorded = (saved[key] ?? "") !== "";
                      const locked = recorded && !canRevise;
                      const raw = marks[key] ?? "";
                      const value = Number(raw);
                      const failed =
                        raw.trim() !== "" && Number.isFinite(value) && examFailed(value, passMark);
                      const current =
                        (column.kind === "week" && column.period === currentWeek) ||
                        (column.kind === "month" && column.period === currentMonth);
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            "border border-black p-0 text-center",
                            column.kind === "month" && "bg-neutral-100",
                            current && "bg-neutral-50"
                          )}
                        >
                          <input
                            value={marks[key] ?? ""}
                            disabled={!canEdit || locked || savingKey === key}
                            readOnly={locked}
                            inputMode="decimal"
                            aria-label={`${student.fullName} ${column.label}`}
                            onChange={(event) =>
                              setMarks((prev) => ({ ...prev, [key]: event.target.value }))
                            }
                            onBlur={(event) => void commit(student, column, event.target.value)}
                            className={cn(
                              "h-7 w-full bg-transparent px-0.5 text-center text-[11px] tabular-nums outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-black disabled:opacity-100",
                              failed ? "font-semibold text-red-700" : "text-black"
                            )}
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
    "border border-black px-1 py-0.5 text-center font-medium tabular-nums",
    monthly && "bg-neutral-100"
  );
  return (
    <>
      <td className={className}>{summary ? formatMark(summary.total) : ""}</td>
      <td className={className}>{summary ? formatMark(summary.average) : ""}</td>
      <td className={className}>{point ?? ""}</td>
    </>
  );
}
