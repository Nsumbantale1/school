import type { ProgressColumn, ProgressKind } from "./progress-chart";
import { progressCellKey } from "./progress-chart";

/** A mark below the pass mark is a failed exam. 55 counts as a pass. */
export function examFailed(mark: number, passMark: number): boolean {
  return mark < passMark;
}

/** Recorded exams in chart order. A blank week is not counted. */
export function recordedExamScores(
  columns: Pick<ProgressColumn, "kind" | "period">[],
  marks: Record<string, string>,
  enrollmentId: number
): number[] {
  const scores: number[] = [];
  for (const column of columns) {
    const raw = marks[progressCellKey(enrollmentId, column.kind, column.period)];
    if (raw == null || raw.trim() === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    scores.push(value);
  }
  return scores;
}

/** How many of the latest recorded exams are fails, until a pass. */
export function trailingFailStreak(scores: number[], passMark: number): number {
  let streak = 0;
  for (let index = scores.length - 1; index >= 0; index--) {
    if (!examFailed(scores[index], passMark)) break;
    streak += 1;
  }
  return streak;
}

export type ProgressStanding = "ok" | "danger" | "ct";

export function standingFromStreak(streak: number): ProgressStanding {
  if (streak >= 3) return "ct";
  if (streak >= 2) return "danger";
  return "ok";
}

export function studentStanding(
  columns: Pick<ProgressColumn, "kind" | "period">[],
  marks: Record<string, string>,
  enrollmentId: number,
  passMark: number
): { standing: ProgressStanding; streak: number } {
  const streak = trailingFailStreak(
    recordedExamScores(columns, marks, enrollmentId),
    passMark
  );
  return { standing: standingFromStreak(streak), streak };
}

export function columnAverages(
  columns: ProgressColumn[],
  marks: Record<string, string>,
  enrollmentIds: number[],
  passMark: number
): { label: string; kind: ProgressKind; average: number | null; fails: number; sat: number }[] {
  return columns.map((column) => {
    const values: number[] = [];
    for (const enrollmentId of enrollmentIds) {
      const raw = marks[progressCellKey(enrollmentId, column.kind, column.period)];
      if (raw == null || raw.trim() === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      values.push(value);
    }
    if (values.length === 0) {
      return { label: column.label, kind: column.kind, average: null, fails: 0, sat: 0 };
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    return {
      label: column.label,
      kind: column.kind,
      average: total / values.length,
      fails: values.filter((value) => examFailed(value, passMark)).length,
      sat: values.length,
    };
  });
}
