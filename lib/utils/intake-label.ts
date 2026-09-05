/**
 * SOFA intake display labels:
 *   same calendar year  →  14/25
 *   spans two years     →  14/25-26
 */

function yyFromDate(
  value: string | Date | null | undefined
): number | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear() % 100;
}

function twoDigit(n: number): string {
  return String(n).padStart(2, "0");
}

/** Leading intake serial, e.g. 14, 15A, 15B from "15A-24", "14/25". */
export function extractIntakeSerial(intakeNumber: string): string {
  const raw = intakeNumber.trim();

  // 15A/24 or 15A-24 or 15A
  const withLetter = raw.match(/^(\d{1,3}[A-Za-z])(?=[-/\s]|$)/);
  if (withLetter) return withLetter[1].toUpperCase();

  const slash = raw.match(/^(\d{1,3})\s*[/]/);
  if (slash) return slash[1];

  const leading = raw.match(/^(\d{1,3})(?!\d)/);
  if (leading) return leading[1];

  const intWord = raw.match(/INT(?:AKE)?\s*[-#]?\s*(\d{1,3}[A-Za-z]?)/i);
  if (intWord) return intWord[1].toUpperCase();

  const anyLetter = raw.match(/(\d{1,3}[A-Za-z])(?=[-/\s]|$)/);
  if (anyLetter) return anyLetter[1].toUpperCase();

  const any = raw.match(/(\d{1,3})/);
  if (any) return any[1];

  return raw.slice(0, 12) || "—";
}

export function extractIntakeBattery(intakeNumber: string): string | null {
  const m = intakeNumber.toUpperCase().match(/(?:^|[-/\s])([PQ])(?:\s*BTY)?(?:$|[-/\s])/);
  return m ? m[1] : null;
}

/**
 * Format: 14/25  or  14/25-26  (+ optional -P / -Q)
 */
export function formatIntakeLabel(opts: {
  intakeNumber: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  year?: number | null;
}): string {
  const serial = extractIntakeSerial(opts.intakeNumber);
  const startYy =
    yyFromDate(opts.startDate) ??
    (opts.year != null ? opts.year % 100 : null);
  const endYy = yyFromDate(opts.endDate);

  let label: string;
  if (startYy == null) {
    label = serial;
  } else if (endYy == null || endYy === startYy) {
    label = `${serial}/${twoDigit(startYy)}`;
  } else {
    label = `${serial}/${twoDigit(startYy)}-${twoDigit(endYy)}`;
  }

  const battery = extractIntakeBattery(opts.intakeNumber);
  if (battery && !new RegExp(`[-/\\s]${battery}(?:$|[-/\\s])`, "i").test(label)) {
    label = `${label}-${battery}`;
  }

  return label;
}
