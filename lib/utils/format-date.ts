/**
 * Calendar (date-only) helpers — avoid timezone shifts from `new Date("YYYY-MM-DD")`.
 */

export type DateParts = { year: number; month: number; day: number };

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Parse a DB/Excel calendar date without applying local timezone offset. */
export function parseDateOnly(
  value: string | Date | null | undefined
): DateParts | null {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return {
        year: Number(iso[1]),
        month: Number(iso[2]),
        day: Number(iso[3]),
      };
    }
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  // Instant timestamps: prefer UTC calendar day (matches Postgres `date` / Excel serial).
  if (
    value instanceof Date ||
    (typeof value === "string" && /T|Z$/i.test(value))
  ) {
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    };
  }

  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

export function formatDateOnly(
  value: string | Date | null | undefined,
  style: "short" | "medium" | "long" | "cert" = "medium"
): string {
  const p = parseDateOnly(value);
  if (!p) return "—";

  const dd = String(p.day).padStart(2, "0");
  const monShort = MONTHS_SHORT[p.month - 1] ?? "???";
  const monLong = MONTHS_LONG[p.month - 1] ?? "???";
  const yyyy = String(p.year);
  const yy = yyyy.slice(-2);

  switch (style) {
    case "short":
      return `${dd}/${String(p.month).padStart(2, "0")}/${yyyy}`;
    case "cert":
      return `${dd} ${monShort} ${yy}`;
    case "long":
      return `${p.day} ${monLong} ${yyyy}`;
    case "medium":
    default:
      return `${dd} ${monShort} ${yyyy}`;
  }
}

/** Inclusive course period label: "14 Aug 2018 – 28 Mar 2019". */
export function formatDatePeriod(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  const a = formatDateOnly(start, "medium");
  if (!end) return a === "—" ? "—" : `${a} → …`;
  const b = formatDateOnly(end, "medium");
  if (a === "—" && b === "—") return "—";
  if (a === "—") return b;
  if (b === "—") return `${a} → …`;
  return `${a} – ${b}`;
}

/** Whole weeks between two calendar dates (noon-safe). */
export function weeksBetweenDates(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): number | null {
  const a = parseDateOnly(start);
  const b = parseDateOnly(end);
  if (!a || !b) return null;
  const t0 = Date.UTC(a.year, a.month - 1, a.day);
  const t1 = Date.UTC(b.year, b.month - 1, b.day);
  if (t1 < t0) return null;
  return Math.max(1, Math.round((t1 - t0) / (7 * 24 * 60 * 60 * 1000)));
}
