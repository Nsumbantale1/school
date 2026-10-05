import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { parseSofaWorkbookAll } from "../lib/utils/sofa-excel";

const roots = process.argv.slice(2);
const norm = (a: string) => a.replace(/\s+/g, " ").trim().toUpperCase();

function walk(d: string, o: string[] = []) {
  for (const n of fs.readdirSync(d)) {
    if (n.startsWith("~$")) continue;
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p, o);
    else if (/\.xlsx?$/i.test(n)) o.push(p);
  }
  return o;
}

function sheetTotals(file: string): Map<string, number> {
  const out = new Map<string, number>();
  const wb = XLSX.readFile(file);
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, defval: null, raw: true });
    let army = "";
    let total: number | null = null;
    for (let i = 0; i < rows.length; i++) {
      const a = String(rows[i]?.[0] ?? "").trim().toUpperCase();
      if (!army && /FORCE NO|NAMBA YA JESHI|NAMBA/.test(a)) army = String(rows[i + 1]?.[0] ?? "");
      if (/^TOTAL MARKS|^ALAMA ZA JUMLA ZA NADHARIA NA VITENDO|^TOTAL AVERAGE|^GRAND TOTAL/.test(a)) {
        for (const c of [9, 8, 7, 5]) {
          const v = rows[i]?.[c];
          if (typeof v === "number") { total = v; break; }
        }
      }
    }
    if (army && total != null) out.set(norm(army), total);
  }
  return out;
}

async function main() {
  for (const root of roots) {
    for (const f of walk(root).sort()) {
      let groups;
      try { groups = parseSofaWorkbookAll(f, path.basename(f)); } catch { continue; }
      const totals = sheetTotals(f);
      let checked = 0, bad = 0;
      const ex: string[] = [];
      for (const g of groups) for (const s of g.students) {
        const t = totals.get(norm(s.armyNumber));
        if (t == null) continue;
        checked++;
        if (Math.abs(t - s.overall) > 0.55) { bad++; if (ex.length < 3) ex.push(`${s.armyNumber} sheet=${t.toFixed(2)} parsed=${s.overall.toFixed(2)}`); }
      }
      if (bad > 0 || checked === 0) console.log(bad ? "BAD " : "NOCHK", `${bad}/${checked}`, f.replace(/.*Desktop\//, ""), ex.join("; "));
    }
  }
  console.log("done");
}
main();
