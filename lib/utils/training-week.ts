import { parseDateOnly } from "./format-date";

export type WeekPhase = "upcoming" | "current" | "completed";

export function trainingWeekStatus(opts: {
  startDate: string | Date | null | undefined;
  endDate?: string | Date | null;
  durationWeeks: number;
  today?: Date;
}): { phase: WeekPhase; week: number; totalWeeks: number } {
  const totalWeeks = Math.max(1, opts.durationWeeks || 1);
  const start = parseDateOnly(opts.startDate);
  if (!start) return { phase: "upcoming", week: 1, totalWeeks };

  const today = opts.today ?? new Date();
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const diffDays = Math.floor((todayUtc - startUtc) / 86_400_000);
  if (diffDays < 0) return { phase: "upcoming", week: 1, totalWeeks };

  const end = parseDateOnly(opts.endDate);
  if (end) {
    const endUtc = Date.UTC(end.year, end.month - 1, end.day);
    if (todayUtc > endUtc) {
      return { phase: "completed", week: totalWeeks, totalWeeks };
    }
  }

  const week = Math.floor(diffDays / 7) + 1;
  if (week > totalWeeks) {
    return { phase: "completed", week: totalWeeks, totalWeeks };
  }
  return { phase: "current", week, totalWeeks };
}

/** A monthly test follows every three weekly tests: weeks 1–3, then M-1. */
export function trainingMonths(durationWeeks: number): number {
  return Math.floor(Math.max(0, durationWeeks) / 3);
}

export function currentTrainingMonth(
  week: number,
  totalMonths: number,
  phase: WeekPhase
): number {
  if (totalMonths < 1) return 0;
  if (phase === "upcoming") return 1;
  return Math.min(totalMonths, Math.max(1, Math.ceil(week / 3)));
}
