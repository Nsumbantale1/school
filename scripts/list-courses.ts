import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../lib/db";
import { courses, courseIntakes } from "../lib/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const all = await db
    .select({
      id: courses.courseId,
      code: courses.courseCode,
      name: courses.courseName,
      active: courses.isActive,
      intakes: sql<number>`(
        select count(*) from course_intakes
        where course_intakes.course_id = courses.course_id
      )`,
    })
    .from(courses)
    .orderBy(courses.courseCode);

  console.log("ALL COURSES:");
  for (const c of all) console.log(JSON.stringify(c));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
