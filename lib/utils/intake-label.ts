/**
 * SOFA intake display labels:
 *   same calendar year  →  14/25
 *   spans two years     →  14/25-26
 */

import { parseDateOnly } from "./format-date";

function yyFromDate(
  value: string | Date | null | undefined
): number | null {
  const p = parseDateOnly(value);
  return p ? p.year % 100 : null;
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

const STORED_INTAKE =
  /^(?:[A-Z]{2,6}\s*[-.]?\s*)?(\d{1,3}[A-Z]?)\s*[-/]\s*(\d{4}|\d{2})(?:\s*[-/]\s*(\d{4}|\d{2}))?(?:\s*[-/]?\s*([A-Z])(?:\s*BTY)?)?$/i;
const YEAR_FIRST_INTAKE = /^INT\w*\s*[-.]?\s*(\d{4})\s*[-/]\s*(\d{1,3}[A-Z]?)$/i;
const SERIAL_ONLY = /^(?:INT\w*\s*[-.]?\s*)?(\d{1,3}[A-Z]?)$/i;

const yy = (year: string) => parseInt(year.slice(-2), 10);
const nextYy = (y: number) => (y + 1) % 100;
const yearsApart = (a: number, b: number) => Math.min(Math.abs(a - b), 100 - Math.abs(a - b));

/**
 * Intake as written on certificates: "INT 18/26" for an intake within one
 * year, "INT 18/26-27" when it starts in 2026 and ends in 2027. Years typed in
 * the intake number win over the dates, unless they are clearly a typo.
 */
export function formatCertificateIntake(opts: {
  intakeNumber: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
}): string {
  const raw = opts.intakeNumber.trim().replace(/\s+/g, " ");
  const startYy = yyFromDate(opts.startDate);
  const endYy = yyFromDate(opts.endDate);

  const fromDates = (serial: string) => {
    if (startYy == null) return serial;
    return endYy != null && endYy === nextYy(startYy)
      ? `${serial}/${twoDigit(startYy)}-${twoDigit(endYy)}`
      : `${serial}/${twoDigit(startYy)}`;
  };

  let label: string;
  const stored = raw.match(STORED_INTAKE);
  const yearFirst = stored ? null : raw.match(YEAR_FIRST_INTAKE);
  const serialOnly = stored || yearFirst ? null : raw.match(SERIAL_ONLY);

  if (stored) {
    const [, serial, first, second, battery] = stored;
    const y1 = yy(first);
    if (startYy != null && yearsApart(y1, startYy) > 1) {
      label = fromDates(serial.toUpperCase());
    } else {
      let y2 = second ? yy(second) : null;
      if (y2 != null && y2 !== nextYy(y1)) y2 = null;
      if (y2 == null && y1 === startYy && endYy === nextYy(y1)) y2 = endYy;
      label = `${serial.toUpperCase()}/${twoDigit(y1)}${y2 != null ? `-${twoDigit(y2)}` : ""}`;
    }
    if (battery) label = `${label}-${battery.toUpperCase()}`;
  } else if (yearFirst) {
    const y1 = yy(yearFirst[1]);
    const y2 = endYy != null && endYy === nextYy(y1) ? endYy : null;
    label = `${yearFirst[2].toUpperCase()}/${twoDigit(y1)}${y2 != null ? `-${twoDigit(y2)}` : ""}`;
  } else if (serialOnly) {
    label = fromDates(serialOnly[1].toUpperCase());
  } else {
    return /^INT\b/i.test(raw) ? raw.toUpperCase() : `INT ${raw.toUpperCase()}`;
  }

  return `INT ${label}`;
}
