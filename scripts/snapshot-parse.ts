import fs from "fs";
import path from "path";
import { parseSofaWorkbookAll } from "../lib/utils/sofa-excel";

const [out, ...roots] = process.argv.slice(2);

function walk(d: string, o: string[] = []) {
  for (const n of fs.readdirSync(d)) {
    if (n.startsWith("~$")) continue;
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p, o);
    else if (/\.xlsx?$/i.test(n)) o.push(p);
  }
  return o;
}

const snap: Record<string, Record<string, number>> = {};
for (const root of roots) {
  for (const f of walk(root).sort()) {
    try {
      const m: Record<string, number> = {};
      for (const g of parseSofaWorkbookAll(f, path.basename(f))) {
        for (const s of g.students) m[`${g.courseCode}|${g.intakeNumber}|${s.armyNumber}`] = s.overall;
      }
      snap[f] = m;
    } catch {
      /* unreadable */
    }
  }
}

if (fs.existsSync(out)) {
  const old = JSON.parse(fs.readFileSync(out, "utf8")) as typeof snap;
  for (const f of Object.keys({ ...old, ...snap }).sort()) {
    const a = old[f] ?? {}, b = snap[f] ?? {};
    const diffs: string[] = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[k] == null || b[k] == null || Math.abs(a[k] - b[k]) > 0.005) diffs.push(`${k}: ${a[k]?.toFixed(2) ?? "-"} -> ${b[k]?.toFixed(2) ?? "-"}`);
    }
    if (diffs.length) console.log(`CHANGED ${diffs.length}/${Object.keys(b).length} ${f.replace(/.*Desktop\//, "")}\n   ${diffs.slice(0, 3).join("\n   ")}`);
  }
  console.log("compare done");
} else {
  fs.writeFileSync(out, JSON.stringify(snap));
  console.log("snapshot saved", Object.keys(snap).length, "files");
}
