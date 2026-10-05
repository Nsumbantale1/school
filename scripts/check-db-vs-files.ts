import "dotenv/config";
import { config } from "dotenv";
import path from "path";
import { and, eq, inArray } from "drizzle-orm";
import { parseSofaWorkbookAll } from "../lib/utils/sofa-excel";

config({ path: ".env.local" });

async function main() {
  const { db } = await import("../lib/db");
  const { enrollments, courseIntakes, courses } = await import("../lib/db/schema");
  for (const f of process.argv.slice(2)) {
    const { normalizeArmyNumber } = await import("../lib/utils/sofa-import");
    const groups = parseSofaWorkbookAll(f, path.basename(f));
    for (const g of groups) {
      g.students.forEach((s) => (s.armyNumber = normalizeArmyNumber(s.armyNumber)));
      const armies = g.students.map((s) => s.armyNumber);
      const rows = await db
        .select({
          army: enrollments.studentArmyNumber,
          intakeId: courseIntakes.intakeId,
          intake: courseIntakes.intakeNumber,
          avg: enrollments.averageMarks,
        })
        .from(enrollments)
        .innerJoin(courseIntakes, eq(courseIntakes.intakeId, enrollments.intakeId))
        .innerJoin(courses, eq(courses.courseId, courseIntakes.courseId))
        .where(and(eq(courses.courseCode, g.courseCode), inArray(enrollments.studentArmyNumber, armies)));
      let match = 0, drift = 0, miss = 0;
      const intakes = new Set<string>();
      const ex: string[] = [];
      for (const s of g.students) {
        const r = rows.filter((x) => x.army === s.armyNumber);
        if (!r.length) { miss++; continue; }
        r.forEach((x) => intakes.add(`${x.intake}#${x.intakeId}`));
        const ok = r.some((x) => Math.abs(parseFloat(String(x.avg)) - Math.min(100, s.overall)) <= 0.55);
        if (ok) match++;
        else { drift++; if (ex.length < 2) ex.push(`${s.armyNumber} db=${r.map((x) => x.avg).join("/")} file=${s.overall.toFixed(2)}`); }
      }
      console.log(
        `${drift ? "DRIFT" : miss === g.students.length ? "NOTIN" : "OK   "} ${g.courseCode} ${g.intakeNumber} n=${g.students.length} match=${match} drift=${drift} miss=${miss} intakes=[${[...intakes].join(",")}] ${ex.join("; ")} :: ${f.replace(/.*Desktop\//, "")}`
      );
    }
  }
}
main().then(() => process.exit(0));
