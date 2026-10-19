import type { ProgressKind } from "./progress-chart";

export type ProgressImportCell = {
  armyNumber: string;
  armyKey: string;
  kind: ProgressKind;
  period: number;
  marks: number;
};

export function armyMatchKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function compactHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isArmyHeader(value: string): boolean {
  const key = compactHeader(value);
  return (
    key === "armyno" ||
    key === "armynumber" ||
    key === "ano" ||
    key === "forceno" ||
    key === "servicenumber"
  );
}

function progressHeader(
  value: string
): { kind: ProgressKind; period: number } | null {
  const compact = value.toLowerCase().replace(/\s+/g, "");
  const month = compact.match(/^(?:monthly|month|m)-?(\d{1,2})$/);
  if (month) {
    const period = Number(month[1]);
    if (period >= 1 && period <= 24) return { kind: "month", period };
  }
  const week = compact.match(/^(?:week|wk|w)?(\d{1,2})$/);
  if (week && !compact.startsWith("m")) {
    const period = Number(week[1]);
    if (period >= 1 && period <= 52) return { kind: "week", period };
  }
  return null;
}

function readMark(raw: string): number | null | "bad" {
  const text = raw.trim();
  if (!text || text === "-" || text === "—") return null;
  const value = Number(text.replace(/%$/, "").replace(/,/g, ""));
  if (!Number.isFinite(value) || value < 0 || value > 100) return "bad";
  return value;
}

/** Read a progress-chart sheet. Blank mark cells are ignored so earlier weeks stay. */
export function parseProgressGrid(rows: string[][]): {
  cells: ProgressImportCell[];
  errors: string[];
} {
  let headerIndex = -1;
  for (let index = 0; index < Math.min(rows.length, 25); index++) {
    if (rows[index]?.some((cell) => isArmyHeader(cell))) {
      headerIndex = index;
      break;
    }
  }
  if (headerIndex < 0) {
    return {
      cells: [],
      errors: [
        "The file needs an Army No column and week columns such as 1, 2, 3 or M-1.",
      ],
    };
  }

  const header = rows[headerIndex] ?? [];
  let armyColumn = -1;
  const markColumns: { index: number; kind: ProgressKind; period: number; label: string }[] = [];
  header.forEach((cell, index) => {
    if (armyColumn < 0 && isArmyHeader(cell)) {
      armyColumn = index;
      return;
    }
    const progress = progressHeader(cell);
    if (progress) markColumns.push({ index, ...progress, label: cell.trim() });
  });

  if (armyColumn < 0 || markColumns.length === 0) {
    return {
      cells: [],
      errors: [
        "The file needs an Army No column and week columns such as 1, 2, 3 or M-1.",
      ],
    };
  }

  const cells: ProgressImportCell[] = [];
  const errors: string[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const armyNumber = (row[armyColumn] ?? "").trim();
    const armyKey = armyMatchKey(armyNumber);
    if (!armyKey) continue;
    for (const column of markColumns) {
      const mark = readMark(row[column.index] ?? "");
      if (mark == null) continue;
      if (mark === "bad") {
        errors.push(`${armyNumber} ${column.label} is not a mark from 0 to 100.`);
        continue;
      }
      cells.push({
        armyNumber,
        armyKey,
        kind: column.kind,
        period: column.period,
        marks: mark,
      });
    }
  }

  if (cells.length === 0 && errors.length === 0) {
    errors.push("No marks were found. Fill the week or M-1 columns and upload again.");
  }
  return { cells, errors };
}
