import { db } from "@/lib/db";
import { enrollments, courses, courseIntakes } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export type ComparisonMode = "intakes" | "courses" | "years";

export interface GradeCount {
  grade: string;
  count: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface ComparisonMetrics {
  label: string;
  subtitle: string;
  totalEnrollments: number;
  completed: number;
  passed: number;
  failed: number;
  incomplete: number;
  indiscipline: number;
  active: number;
  passRate: number;
  avgScore: number | null;
  grades: GradeCount[];
  statuses: StatusCount[];
}

export interface ComparisonResult {
  mode: ComparisonMode;
  sideA: ComparisonMetrics;
  sideB: ComparisonMetrics;
}

const GRADE_ORDER = ["A", "B", "C", "D", "F"];

function buildGradeCounts(
  rows: { grade: string | null }[]
): GradeCount[] {
  const counts = new Map<string, number>();
  for (const g of GRADE_ORDER) counts.set(g, 0);

  for (const row of rows) {
    if (row.grade && counts.has(row.grade)) {
      counts.set(row.grade, (counts.get(row.grade) ?? 0) + 1);
    }
  }

  return GRADE_ORDER.map((grade) => ({
    grade,
    count: counts.get(grade) ?? 0,
  }));
}

function buildStatusCounts(
  rows: { status: string }[]
): StatusCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

function computeMetrics(
  label: string,
  subtitle: string,
  rows: {
    status: string;
    grade: string | null;
    averageMarks: string | null;
  }[]
): ComparisonMetrics {
  const totalEnrollments = rows.length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const failed = rows.filter(
    (r) => r.status === "failed" || r.grade === "F"
  ).length;
  const passed = rows.filter(
    (r) =>
      r.grade !== null &&
      r.grade !== "F" &&
      (r.status === "completed" || r.status === "enrolled" || r.status === "in_progress")
  ).length;
  const incomplete = rows.filter((r) => r.status === "incomplete").length;
  const indiscipline = rows.filter((r) => r.status === "indiscipline").length;
  const active = rows.filter(
    (r) => r.status === "enrolled" || r.status === "in_progress"
  ).length;

  const gradedCompleted = rows.filter(
    (r) => r.status === "completed" && r.grade !== null
  );
  const passRate =
    gradedCompleted.length > 0
      ? Math.round(
          (gradedCompleted.filter((r) => r.grade !== "F").length /
            gradedCompleted.length) *
            100
        )
      : 0;

  const scores = rows
    .map((r) => (r.averageMarks ? parseFloat(r.averageMarks) : null))
    .filter((v): v is number => v !== null && !Number.isNaN(v));

  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

  return {
    label,
    subtitle,
    totalEnrollments,
    completed,
    passed,
    failed,
    incomplete,
    indiscipline,
    active,
    passRate,
    avgScore,
    grades: buildGradeCounts(rows),
    statuses: buildStatusCounts(rows),
  };
}

async function fetchEnrollmentRows(filter: {
  intakeIds?: number[];
  courseIds?: number[];
  years?: number[];
}) {
  const base = db
    .select({
      status: enrollments.status,
      grade: enrollments.grade,
      averageMarks: enrollments.averageMarks,
    })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId));

  if (filter.intakeIds?.length) {
    return base.where(inArray(enrollments.intakeId, filter.intakeIds));
  }
  if (filter.courseIds?.length) {
    return base.where(inArray(courses.courseId, filter.courseIds));
  }
  if (filter.years?.length) {
    return base.where(inArray(courseIntakes.year, filter.years));
  }

  return base;
}

export async function getComparisonOptions() {
  const [courseRows, intakeRows, yearRows] = await Promise.all([
    db
      .select({
        courseId: courses.courseId,
        courseCode: courses.courseCode,
        courseName: courses.courseName,
      })
      .from(courses)
      .where(eq(courses.isActive, true))
      .orderBy(courses.courseCode),
    db
      .select({
        intakeId: courseIntakes.intakeId,
        intakeNumber: courseIntakes.intakeNumber,
        year: courseIntakes.year,
        courseId: courseIntakes.courseId,
        courseCode: courses.courseCode,
      })
      .from(courseIntakes)
      .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
      .orderBy(courseIntakes.year, courseIntakes.intakeNumber),
    db
      .selectDistinct({ year: courseIntakes.year })
      .from(courseIntakes)
      .orderBy(courseIntakes.year),
  ]);

  return {
    courses: courseRows,
    intakes: intakeRows,
    years: yearRows.map((r) => r.year),
  };
}

export async function compareIntakes(
  intakeIdA: number,
  intakeIdB: number
): Promise<ComparisonResult | null> {
  const intakes = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(inArray(courseIntakes.intakeId, [intakeIdA, intakeIdB]));

  const intakeA = intakes.find((i) => i.intakeId === intakeIdA);
  const intakeB = intakes.find((i) => i.intakeId === intakeIdB);
  if (!intakeA || !intakeB) return null;

  const [rowsA, rowsB] = await Promise.all([
    fetchEnrollmentRows({ intakeIds: [intakeIdA] }),
    fetchEnrollmentRows({ intakeIds: [intakeIdB] }),
  ]);

  return {
    mode: "intakes",
    sideA: computeMetrics(
      `${intakeA.courseCode} · ${intakeA.intakeNumber}`,
      `${intakeA.courseName} (${intakeA.year})`,
      rowsA
    ),
    sideB: computeMetrics(
      `${intakeB.courseCode} · ${intakeB.intakeNumber}`,
      `${intakeB.courseName} (${intakeB.year})`,
      rowsB
    ),
  };
}

export async function compareCourses(
  courseIdA: number,
  courseIdB: number
): Promise<ComparisonResult | null> {
  const courseRows = await db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(courses)
    .where(inArray(courses.courseId, [courseIdA, courseIdB]));

  const courseA = courseRows.find((c) => c.courseId === courseIdA);
  const courseB = courseRows.find((c) => c.courseId === courseIdB);
  if (!courseA || !courseB) return null;

  const [rowsA, rowsB] = await Promise.all([
    fetchEnrollmentRows({ courseIds: [courseIdA] }),
    fetchEnrollmentRows({ courseIds: [courseIdB] }),
  ]);

  return {
    mode: "courses",
    sideA: computeMetrics(courseA.courseCode, courseA.courseName, rowsA),
    sideB: computeMetrics(courseB.courseCode, courseB.courseName, rowsB),
  };
}

export async function compareYears(
  yearA: number,
  yearB: number
): Promise<ComparisonResult> {
  const [rowsA, rowsB] = await Promise.all([
    fetchEnrollmentRows({ years: [yearA] }),
    fetchEnrollmentRows({ years: [yearB] }),
  ]);

  return {
    mode: "years",
    sideA: computeMetrics(String(yearA), "All courses in this year", rowsA),
    sideB: computeMetrics(String(yearB), "All courses in this year", rowsB),
  };
}

export async function getComparison(
  mode: ComparisonMode,
  idA: string,
  idB: string
): Promise<ComparisonResult | null> {
  const a = parseInt(idA);
  const b = parseInt(idB);
  if (!a || !b || a === b) return null;

  switch (mode) {
    case "intakes":
      return compareIntakes(a, b);
    case "courses":
      return compareCourses(a, b);
    case "years":
      return compareYears(a, b);
    default:
      return null;
  }
}
