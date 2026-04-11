import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { courses, courseSubjects } from "./schema";

const SUBJECTS_BY_COURSE: Record<string, string[]> = {
  "OBC-01": [
    "Ballistics Fundamentals",
    "Fire Direction Procedures",
    "Artillery Fire Planning",
    "Tactical Employment",
    "Communication Procedures",
    "Leadership & Military Ethics",
  ],
  "OAC-01": [
    "Advanced Ballistics",
    "Joint Fire Support",
    "Battery Command",
    "Operations Planning",
    "Logistics & Sustainment",
    "Military Law",
  ],
  "FDC-01": [
    "Fire Direction Theory",
    "Manual Gunnery",
    "Digital Fire Control",
    "Meteorology Application",
    "Safety Procedures",
  ],
  "FOO-01": [
    "Target Acquisition",
    "Call for Fire",
    "Map Reading & Land Nav",
    "Observed Fire Procedures",
    "Adjustment of Fire",
  ],
  "EBC-01": [
    "Basic Gunnery",
    "Weapon Handling",
    "Drill & Ceremony",
    "Field Craft",
    "First Aid",
  ],
  "EAC-01": [
    "Advanced Gunnery",
    "Squad Leadership",
    "Maintenance Procedures",
    "Tactical Movement",
    "Signal Procedures",
  ],
  "GMC-01": [
    "Howitzer Maintenance",
    "Hydraulic Systems",
    "Recoil Mechanisms",
    "Preventive Maintenance",
    "Field Repair",
  ],
  "SCC-01": [
    "Radio Operations",
    "Encryption Procedures",
    "Antenna Theory",
    "Network Establishment",
  ],
};

async function seedSubjects() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log("=== Seeding Course Subjects ===\n");

  const courseRows = await db.select().from(courses);
  let total = 0;

  for (const c of courseRows) {
    const names = SUBJECTS_BY_COURSE[c.courseCode];
    if (!names) {
      console.log(`   skipping ${c.courseCode} (no subjects defined)`);
      continue;
    }
    for (let i = 0; i < names.length; i++) {
      await db
        .insert(courseSubjects)
        .values({
          courseId: c.courseId,
          subjectName: names[i],
          maxMarks: "100",
          sortOrder: i,
        })
        .onConflictDoNothing();
      total++;
    }
    console.log(`   ${c.courseCode}: ${names.length} subjects`);
  }

  console.log(`\n=== ${total} subjects seeded ===`);
}

seedSubjects().catch(console.error);
