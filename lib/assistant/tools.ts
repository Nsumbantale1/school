import { db } from "@/lib/db";
import {
  students,
  courses,
  courseIntakes,
  enrollments,
} from "@/lib/db/schema";
import { and, asc, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { studentPath } from "@/lib/utils";

/** Common course aliases users type in Swahili/English questions */
export const COURSE_ALIASES: Record<string, string[]> = {
  rog: ["rog", "rogc", "regimental officers", "regimental officer"],
  bcc: ["bcc", "battery commander", "battery command"],
  obgc: ["obgc", "obge", "officer basic"],
  rsoc: ["rsoc"],
  aat: ["aat", "aatc"],
  "arty-tech": ["arty tech", "arty-tech", "artillery technician"],
  mgcc: ["mgcc"],
  faoac: ["faoac", "field artillery officers advanced"],
  ropoc: ["ropoc"],
  asvy: ["asvy", "arty svy", "artillery survey", "asvy-l1", "asvy-l2", "asvy-l3"],
  faqc: ["faqc"],
  obatic: ["obatic"],
};

export function normalizeCourseQuery(raw: string): string {
  const q = raw.toLowerCase().trim();
  for (const [code, aliases] of Object.entries(COURSE_ALIASES)) {
    if (aliases.some((a) => q === a || q.includes(a))) return code.toUpperCase();
  }
  return raw.trim().toUpperCase();
}

export function detectCourseInText(text: string): string | null {
  const q = text.toLowerCase();
  for (const [code, aliases] of Object.entries(COURSE_ALIASES)) {
    for (const a of aliases) {
      if (new RegExp(`\\b${a.replace(/\s+/g, "\\s+")}\\b`, "i").test(q)) {
        return code.toUpperCase();
      }
    }
  }
  const m = q.match(
    /\b(bcc|obgc|rogc?|rsoc|aat|mgcc|faqc|obatic|ebc|eac|gmc|scc|fdc|foo)\b/i
  );
  return m ? normalizeCourseQuery(m[1]) : null;
}

export interface PerformerRow {
  enrollmentId: number;
  armyNumber: string;
  fullName: string;
  rank: string;
  courseCode: string;
  courseName: string;
  intakeNumber: string;
  year: number;
  averageMarks: string | null;
  grade: string | null;
  position: number | null;
  unit: string | null;
}

export async function toolFindTopPerformers(args: {
  courseCode?: string | null;
  year?: number | null;
  position?: number | null;
  limit?: number;
}): Promise<{ rows: PerformerRow[]; rankedBy: "position" | "average" }> {
  const limit = args.limit ?? 5;
  const year = args.year ?? null;
  const position = args.position ?? null;
  const courseCode = args.courseCode
    ? normalizeCourseQuery(args.courseCode)
    : null;

  const baseSelect = {
    enrollmentId: enrollments.enrollmentId,
    armyNumber: students.armyNumber,
    fullName: students.fullName,
    rank: enrollments.rankAtEnrollment,
    courseCode: courses.courseCode,
    courseName: courses.courseName,
    intakeNumber: courseIntakes.intakeNumber,
    year: courseIntakes.year,
    averageMarks: enrollments.averageMarks,
    grade: enrollments.grade,
    position: enrollments.position,
    unit: enrollments.unitAtEnrollment,
  };

  const buildWhere = (requirePosition: boolean) => {
    const parts = [];
    if (requirePosition) {
      parts.push(isNotNull(enrollments.position));
      if (position != null) parts.push(eq(enrollments.position, position));
    } else {
      parts.push(isNotNull(enrollments.averageMarks));
    }
    if (year != null) parts.push(eq(courseIntakes.year, year));
    if (courseCode) {
      parts.push(
        or(
          ilike(courses.courseCode, `%${courseCode}%`),
          ilike(courses.courseName, `%${courseCode}%`)
        )!
      );
    }
    return and(...parts);
  };

  let rows = await db
    .select(baseSelect)
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(buildWhere(true))
    .orderBy(asc(enrollments.position), desc(enrollments.averageMarks))
    .limit(limit);

  if (rows.length > 0) {
    return { rows: rows as PerformerRow[], rankedBy: "position" };
  }

  rows = await db
    .select(baseSelect)
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(buildWhere(false))
    .orderBy(desc(enrollments.averageMarks))
    .limit(limit);

  return { rows: rows as PerformerRow[], rankedBy: "average" };
}

export async function toolFindStudent(query: string) {
  const raw = query.trim().replace(/[?؟!.]+$/g, "").trim();
  if (!raw) return [];

  const tokens = raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  // Prefer full-string match, then each significant token (e.g. ABDALLAH)
  const patterns = [
    `%${raw}%`,
    ...tokens
      .filter((t) => t.length >= 3)
      .map((t) => `%${t}%`),
  ];

  const seen = new Set<string>();
  const results: Array<{
    armyNumber: string;
    fullName: string;
    rank: string;
    unit: string | null;
    phone: string | null;
  }> = [];

  for (const pattern of patterns) {
    const rows = await db
      .select({
        armyNumber: students.armyNumber,
        fullName: students.fullName,
        rank: students.rank,
        unit: students.unit,
        phone: students.phone,
      })
      .from(students)
      .where(
        and(
          eq(students.isActive, true),
          or(
            ilike(students.armyNumber, pattern),
            ilike(students.fullName, pattern)
          )
        )
      )
      .limit(10);

    for (const row of rows) {
      if (seen.has(row.armyNumber)) continue;
      seen.add(row.armyNumber);
      results.push(row);
      if (results.length >= 8) return results;
    }
  }

  return results;
}

export async function toolStudentEnrollments(armyNumber: string) {
  return db
    .select({
      enrollmentId: enrollments.enrollmentId,
      status: enrollments.status,
      grade: enrollments.grade,
      averageMarks: enrollments.averageMarks,
      position: enrollments.position,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(enrollments.studentArmyNumber, armyNumber))
    .orderBy(desc(courseIntakes.year))
    .limit(8);
}

export async function toolFindCourse(query: string) {
  const code = normalizeCourseQuery(query);
  const pattern = `%${code}%`;
  return db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      durationWeeks: courses.durationWeeks,
      passingMark: courses.passingMark,
    })
    .from(courses)
    .where(
      or(
        ilike(courses.courseCode, pattern),
        ilike(courses.courseName, `%${query}%`)
      )
    )
    .limit(5);
}

export async function toolSystemCounts() {
  const [s, c, e] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(eq(students.isActive, true)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(courses)
      .where(eq(courses.isActive, true)),
    db.select({ count: sql<number>`count(*)` }).from(enrollments),
  ]);
  return {
    students: Number(s[0]?.count ?? 0),
    courses: Number(c[0]?.count ?? 0),
    enrollments: Number(e[0]?.count ?? 0),
  };
}

export function formatPerformerAnswer(
  row: PerformerRow,
  opts: { rankedBy: "position" | "average"; ordinal?: number }
): string {
  const pos =
    row.position != null
      ? String(row.position)
      : opts.rankedBy === "average"
        ? `${opts.ordinal ?? 1} (by average)`
        : "—";

  return [
    `${row.armyNumber}`,
    `${row.rank} ${row.fullName}`,
    row.unit ? `Unit: ${row.unit}` : null,
    `Position: ${pos}`,
    `Course: ${row.courseCode} — ${row.courseName}`,
    `Intake: ${row.intakeNumber} (${row.year})`,
    `Average: ${row.averageMarks ?? "—"}%`,
    `Grade: ${row.grade ?? "—"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function performerReferences(rows: PerformerRow[]) {
  if (!rows.length) {
    return [
      {
        label: "Sidebar → Reports → Top Performers",
        href: "/reports/top-performers",
      },
      { label: "Sidebar → Results → Import", href: "/results/import" },
    ];
  }
  const best = rows[0];
  return [
    {
      label: `${best.rank} ${best.fullName}`,
      href: studentPath(best.armyNumber),
      detail: `Army No: ${best.armyNumber}`,
    },
    {
      label: `Enrollment #${best.enrollmentId}`,
      href: `/enrollments/${best.enrollmentId}`,
      detail: `${best.courseCode} ${best.intakeNumber}`,
    },
    {
      label: "Sidebar → Reports → Top Performers",
      href: "/reports/top-performers",
      detail: "Full ranking list",
    },
  ];
}
