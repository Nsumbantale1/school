export type ProgressKind = "week" | "month";

export type ProgressColumn = {
  key: string;
  kind: ProgressKind;
  period: number;
  label: string;
};

/** Columns in the paper order: 1, 2, 3, M-1, 4, 5, 6, M-2, … */
export function progressColumns(durationWeeks: number): ProgressColumn[] {
  const weeks = Math.max(1, durationWeeks || 1);
  const columns: ProgressColumn[] = [];
  let month = 0;
  for (let week = 1; week <= weeks; week++) {
    columns.push({
      key: `w${week}`,
      kind: "week",
      period: week,
      label: String(week),
    });
    if (week % 3 === 0) {
      month += 1;
      columns.push({
        key: `m${month}`,
        kind: "month",
        period: month,
        label: `M-${month}`,
      });
    }
  }
  return columns;
}

export function progressCellKey(
  enrollmentId: number,
  kind: ProgressKind,
  period: number
): string {
  return `${enrollmentId}:${kind}:${period}`;
}

const RANK_SENIORITY: Record<string, number> = {
  general: 100,
  "lieutenant general": 96,
  "lt gen": 96,
  "major general": 92,
  "maj gen": 92,
  "brigadier general": 88,
  brig: 88,
  colonel: 84,
  col: 84,
  "lieutenant colonel": 80,
  "lt col": 80,
  major: 76,
  maj: 76,
  captain: 72,
  capt: 72,
  "first lieutenant": 68,
  "1st lt": 68,
  lieutenant: 64,
  lt: 64,
  "second lieutenant": 60,
  "2lt": 60,
  "2nd lieutenant": 60,
  "sergeant major": 56,
  "sgt maj": 56,
  wo1: 56,
  "first sergeant": 52,
  "master sergeant": 48,
  "sergeant first class": 44,
  "staff sergeant": 40,
  ssgt: 40,
  sergeant: 36,
  sgt: 36,
  ls: 32,
  corporal: 28,
  cpl: 28,
  "lance corporal": 24,
  lcpl: 24,
  "private first class": 16,
  pfc: 16,
  private: 12,
  pte: 12,
};

export function rankSeniority(rank: string): number {
  const key = rank.trim().toLowerCase().replace(/\./g, "");
  return RANK_SENIORITY[key] ?? 0;
}
