import { parseCsv, toCsv } from "./csv";

export type SpreadsheetRows = (string | number | null | undefined)[][];

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return String(value).trim();
}

/** Parse uploaded CSV or Excel (.xlsx / .xls) into a 2D grid. */
export async function parseSpreadsheetFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    const text = await file.text();
    return parseCsv(text);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    return raw
      .map((row) => (Array.isArray(row) ? row.map(cellToString) : []))
      .filter((row) => row.some((cell) => cell !== ""));
  }

  throw new Error("Unsupported file type. Use .xlsx, .xls, or .csv");
}

/** Convert grid to CSV text for the server import action. */
export function rowsToCsvText(rows: string[][]): string {
  return toCsv(rows);
}

/** Download an Excel template (.xlsx). */
export async function downloadExcel(
  filename: string,
  rows: SpreadsheetRows,
  sheetName = "Results"
) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const outName = filename.toLowerCase().endsWith(".xlsx")
    ? filename
    : `${filename}.xlsx`;
  XLSX.writeFile(workbook, outName);
}

export function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".csv") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  );
}
