/**
 * Import official SOFA Excel workbooks (student report sheets).
 *
 * Usage:
 *   npx tsx scripts/import-sofa-workbooks.ts
 *   npx tsx scripts/import-sofa-workbooks.ts /path/to/folder
 *   npx tsx scripts/import-sofa-workbooks.ts --dry-run
 */

import "dotenv/config";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { parseSofaWorkbook } from "../lib/utils/sofa-excel";
import { importParsedSofaWorkbook } from "../lib/utils/sofa-import";

config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");
const args = process.argv.slice(2).filter((a) => a !== "--dry-run");

const DEFAULT_DIRS = [
  path.join(process.cwd(), "data/imports/2025"),
  path.join(process.env.HOME ?? "", "MATOKEO/2025"),
  path.join(process.cwd(), "data/imports/2026"),
  path.join(process.env.HOME ?? "", "MATOKEO/2026"),
];

function shouldSkipWorkbook(name: string): boolean {
  const n = name.toLowerCase();
  if (!n.endsWith(".xlsx")) return true;
  if (n.startsWith("~$")) return true;
  if (n === "mgc.xlsx") return true;
  if (/\(\d+\)\s*\.xlsx$/.test(n)) return true;
  // Empty template — no student identities filled in.
  if (n.includes("artyman l-1 int 24-25")) return true;
  // Filename says 29-25 Q but the sheets are intake 28/25 duplicates.
  // The real 29-25 Q workbook is the "- Copy" file.
  if (n === "artyman l-3 int 29-25 q bty.xlsx") return true;
  if (n.includes("copy")) {
    if (n.includes("29-25") && n.includes("q bty")) return false;
    return true;
  }
  // Summary / chart / conversion sheets — not student reports.
  if (n === "aatc l-2.xlsx") return true;
  if (n.startsWith("conversion")) return true;
  if (n.startsWith("matokeo")) return true;
  if (n.includes("kozi report")) return true;
  // Incomplete duplicate of ARTY SVY L-2 INT 01-24 (many zero marks).
  if (n === "arty svy l-2 int 02.xlsx") return true;
  // Incomplete duplicate of BCC INT 13-24-25 (zero marks).
  if (n === "bcc intak 13-24-25.xlsx") return true;
  // Incomplete duplicate of OBGC INT 24-24 (zero marks).
  if (n === "obgc int 25-24-25.xlsx") return true;
  return false;
}

function listWorkbooks(target: string): string[] {
  const stat = fs.statSync(target);
  if (stat.isFile() && /\.xlsx$/i.test(target)) {
    return shouldSkipWorkbook(path.basename(target)) ? [] : [target];
  }
  if (!stat.isDirectory()) return [];
  return fs
    .readdirSync(target)
    .filter((name) => !shouldSkipWorkbook(name))
    .map((name) => path.join(target, name))
    .sort();
}

async function main() {
  if (!process.env.DATABASE_URL && !dryRun) {
    console.error("DATABASE_URL is missing. Check .env.local");
    process.exit(1);
  }

  const target =
    args[0] ||
    DEFAULT_DIRS.find((dir) => fs.existsSync(dir));

  if (!target) {
    console.error("No workbook folder found. Pass a path to a .xlsx file or directory.");
    process.exit(1);
  }

  const files = listWorkbooks(target);
  if (files.length === 0) {
    console.error("No .xlsx files found in", target);
    process.exit(1);
  }

  console.log(dryRun ? "Dry run (no database writes)" : "Importing into SOFA");
  console.log("Source:", target);
  console.log(`Files: ${files.length}\n`);

  for (const file of files) {
    const filename = path.basename(file);
    try {
      const parsed = parseSofaWorkbook(file, filename);
      console.log(
        `${filename}: ${parsed.courseCode} intake ${parsed.intakeNumber} · ${parsed.students.length} students · ${parsed.year} · ${parsed.startDate} → ${parsed.endDate ?? "—"}`
      );
      if (parsed.warnings.length) {
        for (const w of parsed.warnings) console.log("  warning:", w);
      }
      if (!dryRun) {
        const summary = await importParsedSofaWorkbook(parsed);
        console.log(
          `  imported ${summary.students} students, ${summary.results} results (intake id ${summary.intakeId})`
        );
      }
    } catch (error) {
      console.error(`${filename}: FAILED — ${(error as Error).message}`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
