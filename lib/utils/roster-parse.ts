/**
 * Reads a course roll (msururu) from Excel / CSV, Word (.docx) or PDF and
 * returns one row per student. Server-only: uses xlsx, adm-zip and pdfjs.
 *
 * Column headers (English or Kiswahili) are used when present. Without them
 * a row is any line holding an army number; rank, name and unit follow it.
 */

export type RosterGender = "male" | "female";

export type RosterRow = {
  armyNumber: string;
  rank: string;
  fullName: string;
  unit: string | null;
  gender: RosterGender | null;
};

export type ParsedRoster = {
  source: "excel" | "word" | "pdf";
  rows: RosterRow[];
  warnings: string[];
};

type Grid = string[][];

const ARMY_NUMBER = /\b(MTM|MT|P|M|N)\s*[-.]?\s*(\d{3,7})\b/i;

/** Canonical uppercase rank, as most SOFA records store it. */
const RANK_ALIASES: Array<[RegExp, string]> = [
  [/^(PTE|PVT|PRIVATE|PRAIVETI)$/, "PTE"],
  [/^(L\/?CPL|LANCE ?CPL|LANCE ?CORPORAL|KOPLO ?USU)$/, "LCPL"],
  [/^(CPL|CORPORAL|KOPLO)$/, "CPL"],
  [/^(S\/?SGT|STAFF ?SGT|STAFF ?SERGEANT|SAJINI ?TAJI)$/, "SSGT"],
  [/^(SGT|SERGEANT|SAJINI)$/, "SGT"],
  [/^(W\/?O ?(II|2)|WOII|WO2)$/, "WOII"],
  [/^(W\/?O ?(I|1)|WOI|WO1)$/, "WOI"],
  [/^(2\/?LT|2ND ?LT|2 ?LT|SECOND ?LIEUTENANT|LUTENI ?USU)$/, "2LT"],
  [/^(LT ?COL|LT-COL|LIEUTENANT ?COLONEL|LUTENI ?KANALI)$/, "LT COL"],
  [/^(LT|LIEUTENANT|LUTENI)$/, "LT"],
  [/^(A\/CAPT)$/, "A/CAPT"],
  [/^(CAPT|CAPTAIN|KAPTENI)$/, "CAPT"],
  [/^(MAJ ?GEN|MAJOR ?GENERAL|MEJA ?JENERALI)$/, "MAJ GEN"],
  [/^(MAJ|MAJOR|MEJA)$/, "MAJ"],
  [/^(BRIG ?GEN|BRIGADIER ?GENERAL|BRIGEDIA ?JENERALI)$/, "BRIG GEN"],
  [/^(COL|COLONEL|KANALI)$/, "COL"],
];

const MAX_RANK_WORDS = 3;

export function normalizeRank(value: string): string | null {
  const compact = value.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (!compact) return null;
  for (const [pattern, rank] of RANK_ALIASES) {
    if (pattern.test(compact)) return rank;
  }
  return null;
}

/** "mt128933", "MT-128933" → "MT 128933". */
export function normalizeRosterArmyNumber(value: string): string | null {
  const match = value.match(ARMY_NUMBER);
  return match ? `${match[1].toUpperCase()} ${match[2]}` : null;
}

function normalizeGender(value: string): RosterGender | null {
  const v = value.trim().toLowerCase().replace(/\./g, "");
  if (/^(m|male|me|mume|mwanaume|ume)$/.test(v)) return "male";
  if (/^(f|female|ke|mke|mwanamke|ike)$/.test(v)) return "female";
  return null;
}

function cleanName(value: string): string {
  return value
    .replace(/[|]/g, " ")
    .replace(/^[\s\d.)(-]+/, "")
    .replace(/[,;:.]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cleanUnit(value: string): string | null {
  const unit = value.replace(/\s+/g, " ").trim();
  return unit ? unit.toUpperCase() : null;
}

function cell(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

// ── Header detection ────────────────────────────────────────────────────────

type Columns = {
  army: number;
  rank: number;
  names: number[];
  unit: number;
  gender: number;
};

function headerColumns(row: string[]): Columns | null {
  const cols: Columns = { army: -1, rank: -1, names: [], unit: -1, gender: -1 };
  row.forEach((raw, i) => {
    const h = raw.toLowerCase().replace(/[^a-z/ ]/g, " ").replace(/\s+/g, " ").trim();
    if (!h) return;
    if (
      cols.army < 0 &&
      /\b(army|service|svc|force|namba ya jeshi|namba)\b/.test(h) &&
      !/\bs\/? ?no\b|serial|\bsn\b/.test(h)
    ) {
      cols.army = i;
    } else if (cols.rank < 0 && /\b(rank|cheo)\b/.test(h)) {
      cols.rank = i;
    } else if (cols.unit < 0 && /\b(unit|kikosi|regt|formation|bn|bde)\b/.test(h)) {
      cols.unit = i;
    } else if (cols.gender < 0 && /\b(gender|sex|jinsia|me ke|m f)\b/.test(h)) {
      cols.gender = i;
    } else if (/\b(name|names|jina|majina|surname)\b/.test(h)) {
      cols.names.push(i);
    }
  });
  return cols.army >= 0 && cols.names.length > 0 ? cols : null;
}

/** A rank written in front of the name ("Capt JD Wambura") is split off. */
function splitLeadingRank(text: string): { rank: string | null; rest: string } {
  const words = text.trim().split(/\s+/);
  for (let n = Math.min(MAX_RANK_WORDS, words.length - 1); n >= 1; n--) {
    const rank = normalizeRank(words.slice(0, n).join(" "));
    if (rank) return { rank, rest: words.slice(n).join(" ") };
  }
  return { rank: null, rest: text };
}

function rowFromColumns(row: string[], cols: Columns): RosterRow | null {
  const armyNumber = normalizeRosterArmyNumber(row[cols.army] ?? "");
  if (!armyNumber) return null;
  let rank = cols.rank >= 0 ? normalizeRank(row[cols.rank] ?? "") ?? cell(row[cols.rank]).toUpperCase() : "";
  let name = cols.names.map((i) => row[i] ?? "").join(" ");
  const split = splitLeadingRank(name);
  if (split.rank) {
    rank = rank || split.rank;
    name = split.rest;
  }
  const fullName = cleanName(name);
  if (fullName.replace(/[^A-Z]/g, "").length < 2) return null;
  return {
    armyNumber,
    rank,
    fullName,
    unit: cols.unit >= 0 ? cleanUnit(row[cols.unit] ?? "") : null,
    gender: cols.gender >= 0 ? normalizeGender(row[cols.gender] ?? "") : null,
  };
}

// ── Rows without headers ────────────────────────────────────────────────────

const UNIT_START = /^(\d{2,4}\b|SOFA\b|HQ\b|KJ\b|KMKJ\b|BN\b|BDE\b|REGT\b|JWTZ\b|TPDF\b)/i;

/** Rank / name / unit from free text that follows an army number. */
function rowFromText(armyNumber: string, before: string, after: string): RosterRow | null {
  let words = after.replace(/[|]/g, " ").trim().split(/\s+/).filter(Boolean);
  let rank = normalizeRank(before.trim().split(/\s+/).slice(-2).join(" ")) ??
    normalizeRank(before.trim().split(/\s+/).slice(-1).join(" ")) ?? "";

  for (let n = Math.min(MAX_RANK_WORDS, words.length); n >= 1; n--) {
    const found = normalizeRank(words.slice(0, n).join(" "));
    if (found) {
      rank = found;
      words = words.slice(n);
      break;
    }
  }

  let gender: RosterGender | null = null;
  const last = words[words.length - 1];
  if (last && words.length > 2 && normalizeGender(last)) {
    gender = normalizeGender(last);
    words = words.slice(0, -1);
  }

  const unitAt = words.findIndex((w, i) => i >= 1 && UNIT_START.test(w));
  const nameWords = unitAt >= 0 ? words.slice(0, unitAt) : words;
  const unitWords = unitAt >= 0 ? words.slice(unitAt) : [];
  const fullName = cleanName(nameWords.join(" "));
  if (fullName.replace(/[^A-Z]/g, "").length < 2) return null;
  return {
    armyNumber,
    rank,
    fullName,
    unit: cleanUnit(unitWords.join(" ")),
    gender,
  };
}

/** Table row without headers: army cell, then rank / name / unit cells. */
function rowFromCells(row: string[]): RosterRow | null {
  const armyAt = row.findIndex((c) => ARMY_NUMBER.test(c));
  if (armyAt < 0) return null;
  const armyCell = row[armyAt];
  const match = armyCell.match(ARMY_NUMBER)!;
  const armyNumber = `${match[1].toUpperCase()} ${match[2]}`;
  const inCellBefore = armyCell.slice(0, match.index).trim();
  const inCellAfter = armyCell.slice((match.index ?? 0) + match[0].length).trim();
  const before = [...row.slice(0, armyAt), inCellBefore].join(" ");
  const following = row.slice(armyAt + 1).filter(Boolean);

  if (inCellAfter || following.length < 2) {
    return rowFromText(armyNumber, before, [inCellAfter, ...following].join(" "));
  }

  let i = 0;
  let rank = normalizeRank(following[0]);
  if (rank) i = 1;
  else rank = normalizeRank(before.trim().split(/\s+/).slice(-1).join(" "));

  const split = splitLeadingRank(following[i] ?? "");
  if (split.rank) rank = rank ?? split.rank;
  const fullName = cleanName(split.rest);
  if (fullName.replace(/[^A-Z]/g, "").length < 2) return null;

  const rest = following.slice(i + 1);
  const genderAt = rest.findIndex((c) => normalizeGender(c));
  const gender = genderAt >= 0 ? normalizeGender(rest[genderAt]) : null;
  const unit = rest.find((c, idx) => idx !== genderAt && c.trim()) ?? "";
  return { armyNumber, rank: rank ?? "", fullName, unit: cleanUnit(unit), gender };
}

export function rosterRowsFromGrid(grid: Grid): { rows: RosterRow[]; duplicates: string[] } {
  const rows: RosterRow[] = [];
  const seen = new Set<string>();
  const duplicates: string[] = [];
  let cols: Columns | null = null;

  for (const raw of grid) {
    const row = raw.map(cell);
    if (!row.some(Boolean)) continue;
    if (!ARMY_NUMBER.test(row.join(" "))) {
      cols = headerColumns(row) ?? cols;
      continue;
    }
    const parsed = (cols && rowFromColumns(row, cols)) || rowFromCells(row);
    if (!parsed) continue;
    if (seen.has(parsed.armyNumber)) {
      duplicates.push(parsed.armyNumber);
      continue;
    }
    seen.add(parsed.armyNumber);
    rows.push(parsed);
  }
  return { rows, duplicates };
}

// ── File readers ────────────────────────────────────────────────────────────

async function excelGrids(bytes: Uint8Array): Promise<Grid[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(bytes, { type: "array" });
  return workbook.SheetNames.map((name) =>
    XLSX.utils
      .sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: "", raw: false })
      .map((row) => (Array.isArray(row) ? row.map(cell) : []))
  );
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlText(fragment: string): string {
  const withBreaks = fragment.replace(/<w:(tab|br)\b[^>]*\/>/g, " ");
  return [...withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)]
    .map((m) => decodeXml(m[1]))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

async function wordGrids(bytes: Uint8Array): Promise<Grid[]> {
  const { default: AdmZip } = await import("adm-zip");
  const zip = new AdmZip(Buffer.from(bytes));
  const entry = zip.getEntry("word/document.xml");
  if (!entry) throw new Error("This Word file has no document body.");
  const xml = entry.getData().toString("utf8");

  const tables: Grid[] = [];
  for (const table of xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)) {
    const grid: Grid = [];
    for (const tr of table[0].matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)) {
      grid.push([...tr[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((tc) => xmlText(tc[0])));
    }
    tables.push(grid);
  }

  const outsideTables = xml.replace(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g, "");
  const paragraphs: Grid = [...outsideTables.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)]
    .map((p) => xmlText(p[0]))
    .filter(Boolean)
    .map((line) => line.split(/\t| {2,}/).map(cell));

  return [...tables, paragraphs];
}

type PdfItem = { str: string; x: number; y: number; w: number; h: number };

async function pdfGrids(bytes: Uint8Array): Promise<Grid[]> {
  const [pdfjs, path] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("node:path"),
  ]);
  const standardFonts = path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: standardFonts.replace(/\\/g, "/"),
    useSystemFonts: false,
  });
  const doc = await task.promise;

  const grid: Grid = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      items.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        w: item.width,
        h: Math.abs(item.transform[3]) || 10,
      });
    }

    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: PdfItem[][] = [];
    for (const item of items) {
      const line = lines[lines.length - 1];
      if (line && Math.abs(line[0].y - item.y) <= Math.max(2, item.h * 0.4)) line.push(item);
      else lines.push([item]);
    }

    for (const line of lines) {
      line.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let prevEnd = -Infinity;
      for (const item of line) {
        const gap = item.x - prevEnd;
        if (cells.length && gap < item.h * 0.9) {
          cells[cells.length - 1] += (gap > item.h * 0.15 ? " " : "") + item.str;
        } else {
          cells.push(item.str);
        }
        prevEnd = item.x + item.w;
      }
      grid.push(cells.map(cell));
    }
  }
  await task.destroy();
  return [grid];
}

/** One table-like grid of text rows from a PDF. Scanned pages come back empty. */
export async function extractPdfGrid(bytes: Uint8Array): Promise<string[][]> {
  const [grid] = await pdfGrids(bytes);
  return grid ?? [];
}

export async function parseRosterFile(fileName: string, bytes: Uint8Array): Promise<ParsedRoster> {
  const name = fileName.toLowerCase();
  let source: ParsedRoster["source"];
  let grids: Grid[];

  if (/\.(xlsx|xls|csv)$/.test(name)) {
    source = "excel";
    grids = await excelGrids(bytes);
  } else if (name.endsWith(".docx")) {
    source = "word";
    grids = await wordGrids(bytes);
  } else if (name.endsWith(".pdf")) {
    source = "pdf";
    grids = await pdfGrids(bytes);
  } else if (name.endsWith(".doc")) {
    throw new Error(
      "Old Word (.doc) files cannot be read. Open it in Word and use Save As → Word Document (.docx)."
    );
  } else {
    throw new Error("Unsupported file. Upload Excel (.xlsx, .xls, .csv), Word (.docx) or PDF.");
  }

  const best = grids
    .map((grid) => rosterRowsFromGrid(grid))
    .sort((a, b) => b.rows.length - a.rows.length)[0] ?? { rows: [], duplicates: [] };

  const warnings: string[] = [];
  if (best.duplicates.length) {
    warnings.push(`Listed more than once (kept the first): ${[...new Set(best.duplicates)].join(", ")}`);
  }
  if (source === "pdf" && best.rows.length === 0) {
    warnings.push(
      "No army numbers were found. If this PDF is a scanned image, upload the Excel or Word version instead."
    );
  }
  return { source, rows: best.rows, warnings };
}
