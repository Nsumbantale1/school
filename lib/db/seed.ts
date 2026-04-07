import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "./schema/users";
import { students } from "./schema/students";
import { courses } from "./schema/courses";
import { courseIntakes } from "./schema/course-intakes";
import { coursePrerequisites } from "./schema/course-prerequisites";
import { enrollments } from "./schema/enrollments";
import { results } from "./schema/results";
import { calculateGrade } from "../utils/grades";

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltStr = btoa(String.fromCharCode(...salt));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashStr = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `${saltStr}:${hashStr}`;
}

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log("=== Seeding School of Field Artillery ===\n");

  // --- Users ---
  console.log("1. Seeding users...");
  const seedUsers = [
    { username: "admin", password: "admin123", name: "System Administrator", role: "admin" as const },
    { username: "instructor", password: "inst123", name: "Course Instructor", role: "instructor" as const },
    { username: "viewer", password: "view123", name: "Records Viewer", role: "viewer" as const },
  ];
  for (const u of seedUsers) {
    const passwordHash = await hashPassword(u.password);
    await db.insert(users).values({
      username: u.username,
      passwordHash,
      name: u.name,
      role: u.role,
    }).onConflictDoNothing();
  }
  console.log("   3 users created.\n");

  // --- Students (20) ---
  console.log("2. Seeding students...");
  const studentData = [
    { armyNumber: "SN-1001", rank: "Major", fullName: "James Ochieng", gender: "male" as const, unit: "1st Artillery Brigade", dateOfBirth: "1985-03-15", phone: "0712345001", email: "james.ochieng@army.go.ke" },
    { armyNumber: "SN-1002", rank: "Captain", fullName: "Sarah Wanjiku", gender: "female" as const, unit: "2nd Artillery Brigade", dateOfBirth: "1990-07-22", phone: "0712345002", email: "sarah.wanjiku@army.go.ke" },
    { armyNumber: "SN-1003", rank: "Lieutenant", fullName: "Peter Mwangi", gender: "male" as const, unit: "3rd Artillery Brigade", dateOfBirth: "1992-11-08", phone: "0712345003", email: "peter.mwangi@army.go.ke" },
    { armyNumber: "SN-1004", rank: "Lieutenant", fullName: "Grace Akinyi", gender: "female" as const, unit: "1st Artillery Brigade", dateOfBirth: "1993-01-30", phone: "0712345004", email: "grace.akinyi@army.go.ke" },
    { armyNumber: "SN-1005", rank: "2nd Lieutenant", fullName: "David Kipchoge", gender: "male" as const, unit: "4th Artillery Brigade", dateOfBirth: "1995-05-12", phone: "0712345005", email: "david.kipchoge@army.go.ke" },
    { armyNumber: "SN-1006", rank: "2nd Lieutenant", fullName: "Faith Njeri", gender: "female" as const, unit: "2nd Artillery Brigade", dateOfBirth: "1996-09-18", phone: "0712345006", email: "faith.njeri@army.go.ke" },
    { armyNumber: "SN-1007", rank: "Captain", fullName: "John Kamau", gender: "male" as const, unit: "1st Artillery Brigade", dateOfBirth: "1988-12-05", phone: "0712345007", email: "john.kamau@army.go.ke" },
    { armyNumber: "SN-1008", rank: "Major", fullName: "Elizabeth Otieno", gender: "female" as const, unit: "3rd Artillery Brigade", dateOfBirth: "1984-06-27", phone: "0712345008", email: "elizabeth.otieno@army.go.ke" },
    { armyNumber: "SN-1009", rank: "Lieutenant", fullName: "Michael Nyongo", gender: "male" as const, unit: "4th Artillery Brigade", dateOfBirth: "1991-04-14", phone: "0712345009", email: "michael.nyongo@army.go.ke" },
    { armyNumber: "SN-1010", rank: "2nd Lieutenant", fullName: "Agnes Chebet", gender: "female" as const, unit: "2nd Artillery Brigade", dateOfBirth: "1997-08-03", phone: "0712345010", email: "agnes.chebet@army.go.ke" },
    { armyNumber: "SN-2001", rank: "Sergeant Major", fullName: "Robert Mutua", gender: "male" as const, unit: "1st Artillery Brigade", dateOfBirth: "1982-02-20", phone: "0712345011", email: "robert.mutua@army.go.ke" },
    { armyNumber: "SN-2002", rank: "Staff Sergeant", fullName: "Mary Wambui", gender: "female" as const, unit: "2nd Artillery Brigade", dateOfBirth: "1987-10-11", phone: "0712345012", email: "mary.wambui@army.go.ke" },
    { armyNumber: "SN-2003", rank: "Sergeant", fullName: "Joseph Omondi", gender: "male" as const, unit: "3rd Artillery Brigade", dateOfBirth: "1989-07-04", phone: "0712345013", email: "joseph.omondi@army.go.ke" },
    { armyNumber: "SN-2004", rank: "Sergeant", fullName: "Catherine Nyambura", gender: "female" as const, unit: "1st Artillery Brigade", dateOfBirth: "1990-03-25", phone: "0712345014", email: "catherine.nyambura@army.go.ke" },
    { armyNumber: "SN-2005", rank: "Corporal", fullName: "Daniel Kipruto", gender: "male" as const, unit: "4th Artillery Brigade", dateOfBirth: "1993-12-16", phone: "0712345015", email: "daniel.kipruto@army.go.ke" },
    { armyNumber: "SN-2006", rank: "Corporal", fullName: "Jane Achieng", gender: "female" as const, unit: "2nd Artillery Brigade", dateOfBirth: "1994-06-09", phone: "0712345016", email: "jane.achieng@army.go.ke" },
    { armyNumber: "SN-2007", rank: "Private", fullName: "Samuel Njoroge", gender: "male" as const, unit: "3rd Artillery Brigade", dateOfBirth: "1998-01-28", phone: "0712345017", email: "samuel.njoroge@army.go.ke" },
    { armyNumber: "SN-2008", rank: "Private", fullName: "Lucy Kemunto", gender: "female" as const, unit: "1st Artillery Brigade", dateOfBirth: "1999-05-07", phone: "0712345018", email: "lucy.kemunto@army.go.ke" },
    { armyNumber: "SN-2009", rank: "Private", fullName: "Patrick Wekesa", gender: "male" as const, unit: "4th Artillery Brigade", dateOfBirth: "1998-11-19", phone: "0712345019", email: "patrick.wekesa@army.go.ke" },
    { armyNumber: "SN-2010", rank: "Private", fullName: "Mercy Moraa", gender: "female" as const, unit: "2nd Artillery Brigade", dateOfBirth: "2000-04-02", phone: "0712345020", email: "mercy.moraa@army.go.ke" },
  ];
  for (const s of studentData) {
    await db.insert(students).values(s).onConflictDoNothing();
  }
  console.log("   20 students created.\n");

  // --- Courses (8) ---
  console.log("3. Seeding courses...");
  const courseData = [
    { courseCode: "OBC-01", courseName: "Officer Basic Course", durationWeeks: 24, passingMark: 50, description: "Basic artillery officer training covering gunnery, tactics, and leadership" },
    { courseCode: "OAC-01", courseName: "Officer Advanced Course", durationWeeks: 36, passingMark: 50, description: "Advanced artillery operations and planning for senior officers" },
    { courseCode: "FDC-01", courseName: "Fire Direction Center Course", durationWeeks: 12, passingMark: 50, description: "Specialized training in fire direction center operations" },
    { courseCode: "FOO-01", courseName: "Forward Observer Course", durationWeeks: 12, passingMark: 50, description: "Training for forward observation and target acquisition" },
    { courseCode: "EBC-01", courseName: "Enlisted Basic Course", durationWeeks: 16, passingMark: 50, description: "Basic artillery training for enlisted soldiers" },
    { courseCode: "EAC-01", courseName: "Enlisted Advanced Course", durationWeeks: 24, passingMark: 50, description: "Advanced NCO training for artillery operations" },
    { courseCode: "GMC-01", courseName: "Gun Maintenance Course", durationWeeks: 12, passingMark: 50, description: "Equipment maintenance and repair for artillery systems" },
    { courseCode: "SCC-01", courseName: "Signal Communication Course", durationWeeks: 8, passingMark: 50, description: "Communication systems operation for artillery units" },
  ];
  for (const c of courseData) {
    await db.insert(courses).values(c).onConflictDoNothing();
  }
  console.log("   8 courses created.\n");

  // --- Get course IDs ---
  const courseRows = await db.select().from(courses);
  const courseMap: Record<string, number> = {};
  for (const c of courseRows) {
    courseMap[c.courseCode] = c.courseId;
  }

  // --- Course Prerequisites ---
  console.log("4. Seeding course prerequisites...");
  const prereqData = [
    { courseCode: "OAC-01", prerequisiteCode: "OBC-01", isOptional: false },
    { courseCode: "FDC-01", prerequisiteCode: "OBC-01", isOptional: false },
    { courseCode: "FOO-01", prerequisiteCode: "OBC-01", isOptional: false },
    { courseCode: "EAC-01", prerequisiteCode: "EBC-01", isOptional: false },
    { courseCode: "GMC-01", prerequisiteCode: "EBC-01", isOptional: true },
  ];
  for (const p of prereqData) {
    const courseId = courseMap[p.courseCode];
    const prereqId = courseMap[p.prerequisiteCode];
    if (courseId && prereqId) {
      await db.insert(coursePrerequisites).values({
        courseId,
        prerequisiteCourseId: prereqId,
        isOptional: p.isOptional,
      }).onConflictDoNothing();
    }
  }
  console.log("   5 prerequisites created.\n");

  // --- Course Intakes ---
  console.log("5. Seeding course intakes...");
  const intakeData = [
    { courseCode: "OBC-01", intakeNumber: "OBC-2024-01", year: 2024, commanderName: "Col. James Maina", coordinatorName: "Maj. Peter Kiptoo", startDate: "2024-01-15", endDate: "2024-07-15" },
    { courseCode: "OBC-01", intakeNumber: "OBC-2025-01", year: 2025, commanderName: "Col. James Maina", coordinatorName: "Maj. Peter Kiptoo", startDate: "2025-01-15", endDate: "2025-07-15" },
    { courseCode: "OAC-01", intakeNumber: "OAC-2025-01", year: 2025, commanderName: "Brig. David Kimani", coordinatorName: "Lt. Col. Sarah Ochieng", startDate: "2025-06-01", endDate: "2025-12-31" },
    { courseCode: "FDC-01", intakeNumber: "FDC-2025-01", year: 2025, commanderName: "Lt. Col. John Otieno", coordinatorName: "Maj. Grace Wanjiru", startDate: "2025-09-01", endDate: "2025-11-30" },
    { courseCode: "FOO-01", intakeNumber: "FOO-2025-01", year: 2025, commanderName: "Lt. Col. Michael Kipchoge", coordinatorName: "Capt. Faith Njeri", startDate: "2025-10-01", endDate: "2025-12-31" },
    { courseCode: "EBC-01", intakeNumber: "EBC-2024-01", year: 2024, commanderName: "Maj. Robert Wanyama", coordinatorName: "Capt. Mary Akinyi", startDate: "2024-02-01", endDate: "2024-06-01" },
    { courseCode: "EBC-01", intakeNumber: "EBC-2025-01", year: 2025, commanderName: "Maj. Robert Wanyama", coordinatorName: "Capt. Mary Akinyi", startDate: "2025-02-01", endDate: "2025-06-01" },
    { courseCode: "EAC-01", intakeNumber: "EAC-2025-01", year: 2025, commanderName: "Lt. Col. Joseph Mwangi", coordinatorName: "Maj. Jane Chebet", startDate: "2025-07-01", endDate: "2025-12-31" },
    { courseCode: "GMC-01", intakeNumber: "GMC-2025-01", year: 2025, commanderName: "Maj. Daniel Oduor", coordinatorName: "Capt. Agnes Nyambura", startDate: "2025-09-15", endDate: "2025-12-15" },
    { courseCode: "SCC-01", intakeNumber: "SCC-2025-01", year: 2025, commanderName: "Maj. Patrick Kimani", coordinatorName: "Capt. Lucy Wambui", startDate: "2025-10-01", endDate: "2025-11-30" },
    { courseCode: "OBC-01", intakeNumber: "OBC-2026-01", year: 2026, commanderName: "Col. James Maina", coordinatorName: "Maj. Peter Kiptoo", startDate: "2026-01-15", endDate: "2026-07-15" },
  ];

  const intakeMap: Record<string, number> = {};
  for (const i of intakeData) {
    const courseId = courseMap[i.courseCode];
    if (!courseId) continue;
    const result = await db.insert(courseIntakes).values({
      courseId,
      intakeNumber: i.intakeNumber,
      year: i.year,
      commanderName: i.commanderName,
      coordinatorName: i.coordinatorName,
      startDate: i.startDate,
      endDate: i.endDate,
    }).onConflictDoNothing().returning({ id: courseIntakes.intakeId });
    if (result[0]) {
      intakeMap[i.intakeNumber] = result[0].id;
    }
  }
  console.log("   11 intakes created.\n");

  // Re-fetch intakes to get all IDs (in case some already existed)
  const intakeRows = await db.select().from(courseIntakes);
  for (const i of intakeRows) {
    intakeMap[i.intakeNumber] = i.intakeId;
  }

  // --- Enrollments ---
  console.log("6. Seeding enrollments...");
  const enrollmentData = [
    // OBC-2024-01 (completed)
    { armyNumber: "SN-1003", intakeNumber: "OBC-2024-01", status: "completed" as const, averageMarks: "82.50", grade: "A" as const, position: 2 },
    { armyNumber: "SN-1004", intakeNumber: "OBC-2024-01", status: "completed" as const, averageMarks: "91.00", grade: "A" as const, position: 1 },
    { armyNumber: "SN-1005", intakeNumber: "OBC-2024-01", status: "completed" as const, averageMarks: "75.30", grade: "B" as const, position: 3 },
    { armyNumber: "SN-1006", intakeNumber: "OBC-2024-01", status: "completed" as const, averageMarks: "68.00", grade: "B" as const, position: 4 },
    // OBC-2025-01 (in progress)
    { armyNumber: "SN-1009", intakeNumber: "OBC-2025-01", status: "enrolled" as const },
    { armyNumber: "SN-1010", intakeNumber: "OBC-2025-01", status: "enrolled" as const },
    // OAC-2025-01 (in progress)
    { armyNumber: "SN-1002", intakeNumber: "OAC-2025-01", status: "enrolled" as const },
    { armyNumber: "SN-1007", intakeNumber: "OAC-2025-01", status: "enrolled" as const },
    // FDC-2025-01
    { armyNumber: "SN-1003", intakeNumber: "FDC-2025-01", status: "enrolled" as const },
    // FOO-2025-01
    { armyNumber: "SN-1005", intakeNumber: "FOO-2025-01", status: "enrolled" as const },
    // EBC-2024-01 (completed)
    { armyNumber: "SN-2003", intakeNumber: "EBC-2024-01", status: "completed" as const, averageMarks: "88.00", grade: "A" as const, position: 1 },
    { armyNumber: "SN-2004", intakeNumber: "EBC-2024-01", status: "completed" as const, averageMarks: "72.50", grade: "B" as const, position: 3 },
    { armyNumber: "SN-2005", intakeNumber: "EBC-2024-01", status: "completed" as const, averageMarks: "79.00", grade: "B" as const, position: 2 },
    { armyNumber: "SN-2006", intakeNumber: "EBC-2024-01", status: "failed" as const, averageMarks: "42.00", grade: "F" as const, position: 4 },
    // EBC-2025-01
    { armyNumber: "SN-2007", intakeNumber: "EBC-2025-01", status: "enrolled" as const },
    { armyNumber: "SN-2008", intakeNumber: "EBC-2025-01", status: "enrolled" as const },
    // EAC-2025-01
    { armyNumber: "SN-2001", intakeNumber: "EAC-2025-01", status: "enrolled" as const },
    { armyNumber: "SN-2002", intakeNumber: "EAC-2025-01", status: "enrolled" as const },
    // GMC-2025-01
    { armyNumber: "SN-2009", intakeNumber: "GMC-2025-01", status: "enrolled" as const },
    // SCC-2025-01
    { armyNumber: "SN-2010", intakeNumber: "SCC-2025-01", status: "enrolled" as const },
  ];

  const enrollmentIds: Record<string, number> = {};
  for (const e of enrollmentData) {
    const intakeId = intakeMap[e.intakeNumber];
    if (!intakeId) continue;
    const result = await db.insert(enrollments).values({
      studentArmyNumber: e.armyNumber,
      intakeId,
      status: e.status,
      averageMarks: e.averageMarks ?? null,
      grade: e.grade ?? null,
      position: e.position ?? null,
    }).onConflictDoNothing().returning({ id: enrollments.enrollmentId });
    if (result[0]) {
      enrollmentIds[`${e.armyNumber}-${e.intakeNumber}`] = result[0].id;
    }
  }
  console.log("   20 enrollments created.\n");

  // Re-fetch enrollments to get all IDs
  const enrollmentRows = await db.select().from(enrollments);
  const enrollmentRowsMap: Record<string, typeof enrollmentRows[0]> = {};
  for (const e of enrollmentRows) {
    const intake = intakeRows.find(i => i.intakeId === e.intakeId);
    if (intake) {
      enrollmentRowsMap[`${e.studentArmyNumber}-${intake.intakeNumber}`] = e;
      enrollmentIds[`${e.studentArmyNumber}-${intake.intakeNumber}`] = e.enrollmentId;
    }
  }

  // --- Results ---
  console.log("7. Seeding results...");
  const subjects = [
    "Ballistics Fundamentals",
    "Fire Direction Procedures",
    "Artillery Fire Planning",
    "Tactical Employment",
    "Communication Procedures",
  ];

  const resultData: Array<{
    enrollmentKey: string;
    subjectName: string;
    marksObtained: string;
    maxMarks: string;
    remarks?: string;
  }> = [];

  // OBC-2024-01 completed results
  const obc2024Results = [
    { armyNumber: "SN-1003", scores: [85, 80, 82, 84, 80] }, // avg ~82
    { armyNumber: "SN-1004", scores: [95, 90, 92, 88, 90] }, // avg ~91
    { armyNumber: "SN-1005", scores: [78, 72, 76, 74, 76] }, // avg ~75
    { armyNumber: "SN-1006", scores: [70, 65, 68, 66, 71] }, // avg ~68
  ];

  for (const student of obc2024Results) {
    for (let i = 0; i < subjects.length; i++) {
      resultData.push({
        enrollmentKey: `${student.armyNumber}-OBC-2024-01`,
        subjectName: subjects[i],
        marksObtained: student.scores[i].toString(),
        maxMarks: "100",
      });
    }
  }

  // EBC-2024-01 completed results
  const ebc2024Results = [
    { armyNumber: "SN-2003", scores: [90, 88, 86, 89, 87] }, // avg ~88
    { armyNumber: "SN-2004", scores: [74, 70, 73, 72, 73] }, // avg ~72
    { armyNumber: "SN-2005", scores: [80, 78, 79, 78, 80] }, // avg ~79
    { armyNumber: "SN-2006", scores: [44, 40, 42, 41, 43] }, // avg ~42 (failed)
  ];

  for (const student of ebc2024Results) {
    for (let i = 0; i < subjects.length; i++) {
      resultData.push({
        enrollmentKey: `${student.armyNumber}-EBC-2024-01`,
        subjectName: subjects[i],
        marksObtained: student.scores[i].toString(),
        maxMarks: "100",
        remarks: student.scores[i] < 50 ? "Needs improvement" : undefined,
      });
    }
  }

  let resultCount = 0;
  for (const r of resultData) {
    const enrollmentId = enrollmentIds[r.enrollmentKey];
    if (!enrollmentId) continue;

    const marks = parseFloat(r.marksObtained);
    const maxMarks = parseFloat(r.maxMarks);
    const grade = calculateGrade(marks, maxMarks);

    await db.insert(results).values({
      enrollmentId,
      subjectName: r.subjectName,
      marksObtained: r.marksObtained,
      maxMarks: r.maxMarks,
      grade,
      remarks: r.remarks ?? null,
    }).onConflictDoNothing();
    resultCount++;
  }
  console.log(`   ${resultCount} results created.\n`);

  console.log("=== Seed complete! ===");
  console.log("\nLogin credentials:");
  console.log("  admin      / admin123  (Admin - full access)");
  console.log("  instructor / inst123   (Instructor - results only)");
  console.log("  viewer     / view123   (Viewer - read only)");
  console.log("\nSummary:");
  console.log("  - 20 students (army numbers SN-1001 to SN-2010)");
  console.log("  - 8 courses with prerequisites");
  console.log("  - 11 course intakes (2024-2026)");
  console.log("  - 20 enrollments");
  console.log("  - 40 results with auto-calculated grades");
}

seed().catch(console.error);
