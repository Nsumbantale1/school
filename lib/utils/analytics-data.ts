import { db } from "@/lib/db";
import {
  students,
  enrollments,
  courses,
  courseIntakes,
  results,
} from "@/lib/db/schema";
import { eq, sql, desc, and, type SQL } from "drizzle-orm";

export interface AnalyticsFilterParams {
  year?: number;
  courseId?: number;
}

export interface KpiMetric {
  value: number;
  label: string;
  change?: number | null;
  suffix?: string;
}

export interface GradeRow {
  grade: string;
  count: number;
  percentage: number;
}

export interface TrendRow {
  year: number;
  enrollments: number;
  completions: number;
  passRate: number;
  failed: number;
}

export interface StatusRow {
  status: string;
  count: number;
  percentage: number;
}

export interface CoursePerformanceRow {
  courseId: number;
  courseCode: string;
  courseName: string;
  total: number;
  completed: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number | null;
}

export interface IntakePerformanceRow {
  intakeId: number;
  intakeNumber: string;
  year: number;
  courseCode: string;
  courseName: string;
  total: number;
  completed: number;
  passRate: number;
  avgScore: number | null;
}

export interface SubjectAnalysisRow {
  subjectName: string;
  attempts: number;
  avgPercentage: number;
  passRate: number;
}

export interface MonthlyRow {
  month: string;
  enrollments: number;
}

export interface AnalyticsDashboardData {
  filters: {
    years: number[];
    courses: { courseId: number; courseCode: string; courseName: string }[];
    selectedYear?: number;
    selectedCourseId?: number;
  };
  kpis: {
    totalStudents: KpiMetric;
    totalEnrollments: KpiMetric;
    completed: KpiMetric;
    passRate: KpiMetric;
    avgScore: KpiMetric;
    failed: KpiMetric;
    atRisk: KpiMetric;
  };
  gradeDistribution: GradeRow[];
  enrollmentTrend: TrendRow[];
  statusBreakdown: StatusRow[];
  coursePerformance: CoursePerformanceRow[];
  intakePerformance: IntakePerformanceRow[];
  subjectAnalysis: SubjectAnalysisRow[];
  monthlyEnrollments: MonthlyRow[];
}

const GRADES = ["A", "B", "C", "D", "F"] as const;
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function enrollmentJoinConditions(filters: AnalyticsFilterParams): SQL[] {
  const conditions: SQL[] = [];
  if (filters.year) conditions.push(eq(courseIntakes.year, filters.year));
  if (filters.courseId) conditions.push(eq(courses.courseId, filters.courseId));
  return conditions;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export async function getAnalyticsDashboard(
  filters: AnalyticsFilterParams = {}
): Promise<AnalyticsDashboardData> {
  const currentYear = new Date().getFullYear();
  const filterYear = filters.year ?? currentYear;
  const prevYear = filterYear - 1;

  const [yearRows, courseRows, studentCount] = await Promise.all([
    db
      .selectDistinct({ year: courseIntakes.year })
      .from(courseIntakes)
      .orderBy(desc(courseIntakes.year)),
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
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(eq(students.isActive, true)),
  ]);

  const baseConditions = enrollmentJoinConditions(filters);
  const yearConditions = enrollmentJoinConditions({ ...filters, year: filterYear });
  const prevYearConditions = enrollmentJoinConditions({ ...filters, year: prevYear });

  async function enrollmentStats(conditions: SQL[]) {
    const where = conditions.length ? and(...conditions) : undefined;
    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        completed: sql<number>`sum(case when ${enrollments.status} = 'completed' then 1 else 0 end)`,
        passed: sql<number>`sum(case when ${enrollments.grade} is not null and ${enrollments.grade} != 'F' then 1 else 0 end)`,
        failed: sql<number>`sum(case when ${enrollments.status} = 'failed' or ${enrollments.grade} = 'F' then 1 else 0 end)`,
        incomplete: sql<number>`sum(case when ${enrollments.status} = 'incomplete' then 1 else 0 end)`,
        indiscipline: sql<number>`sum(case when ${enrollments.status} = 'indiscipline' then 1 else 0 end)`,
        active: sql<number>`sum(case when ${enrollments.status} in ('enrolled', 'in_progress') then 1 else 0 end)`,
        graded: sql<number>`sum(case when ${enrollments.status} = 'completed' and ${enrollments.grade} is not null then 1 else 0 end)`,
        passedCompleted: sql<number>`sum(case when ${enrollments.status} = 'completed' and ${enrollments.grade} is not null and ${enrollments.grade} != 'F' then 1 else 0 end)`,
        avgScore: sql<number>`avg(cast(${enrollments.averageMarks} as numeric))`,
      })
      .from(enrollments)
      .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
      .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
      .where(where);

    const total = Number(row?.total ?? 0);
    const graded = Number(row?.graded ?? 0);
    const passedCompleted = Number(row?.passedCompleted ?? 0);

    return {
      total,
      completed: Number(row?.completed ?? 0),
      passed: Number(row?.passed ?? 0),
      failed: Number(row?.failed ?? 0),
      incomplete: Number(row?.incomplete ?? 0),
      indiscipline: Number(row?.indiscipline ?? 0),
      active: Number(row?.active ?? 0),
      passRate: graded > 0 ? Math.round((passedCompleted / graded) * 100) : 0,
      avgScore: row?.avgScore ? Math.round(Number(row.avgScore)) : null,
      atRisk: Number(row?.failed ?? 0) + Number(row?.incomplete ?? 0) + Number(row?.indiscipline ?? 0),
    };
  }

  const [filteredStats, yearStats, prevYearStats] = await Promise.all([
    enrollmentStats(baseConditions),
    enrollmentStats(yearConditions),
    enrollmentStats(prevYearConditions),
  ]);

  const gradeWhere = and(
    eq(enrollments.status, "completed"),
    ...(baseConditions.length ? baseConditions : [])
  );

  const gradeDistribution = await db
    .select({
      grade: enrollments.grade,
      count: sql<number>`count(*)`,
    })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(gradeWhere)
    .groupBy(enrollments.grade);

  const totalGraded = gradeDistribution.reduce((s, g) => s + Number(g.count), 0);
  const gradeChartData: GradeRow[] = GRADES.map((grade) => {
    const found = gradeDistribution.find((g) => g.grade === grade);
    const count = found ? Number(found.count) : 0;
    return {
      grade,
      count,
      percentage: totalGraded > 0 ? Math.round((count / totalGraded) * 1000) / 10 : 0,
    };
  });

  const statusRows = await db
    .select({
      status: enrollments.status,
      count: sql<number>`count(*)`,
    })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(baseConditions.length ? and(...baseConditions) : undefined)
    .groupBy(enrollments.status);

  const statusTotal = statusRows.reduce((s, r) => s + Number(r.count), 0);
  const statusBreakdown: StatusRow[] = statusRows
    .map((r) => ({
      status: r.status.replace(/_/g, " "),
      count: Number(r.count),
      percentage: statusTotal > 0 ? Math.round((Number(r.count) / statusTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const fiveYearsAgo = currentYear - 4;
  const enrollmentTrend: TrendRow[] = [];

  for (let year = fiveYearsAgo; year <= currentYear; year++) {
    const yearFilter = enrollmentJoinConditions({ ...filters, year });
    const stats = await enrollmentStats(yearFilter);
    enrollmentTrend.push({
      year,
      enrollments: stats.total,
      completions: stats.completed,
      passRate: stats.passRate,
      failed: stats.failed,
    });
  }

  const courseWhere = and(
    eq(enrollments.status, "completed"),
    ...(baseConditions.length ? baseConditions : [])
  );

  const coursePerformanceRaw = await db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      total: sql<number>`count(*)`,
      passed: sql<number>`sum(case when ${enrollments.grade} != 'F' and ${enrollments.grade} is not null then 1 else 0 end)`,
      failed: sql<number>`sum(case when ${enrollments.grade} = 'F' then 1 else 0 end)`,
      avgScore: sql<number>`avg(cast(${enrollments.averageMarks} as numeric))`,
    })
    .from(courses)
    .innerJoin(courseIntakes, eq(courses.courseId, courseIntakes.courseId))
    .innerJoin(enrollments, eq(courseIntakes.intakeId, enrollments.intakeId))
    .where(courseWhere)
    .groupBy(courses.courseId, courses.courseCode, courses.courseName)
    .orderBy(desc(sql`count(*)`));

  const coursePerformance: CoursePerformanceRow[] = coursePerformanceRaw.map((c) => {
    const total = Number(c.total);
    const passed = Number(c.passed);
    return {
      courseId: c.courseId,
      courseCode: c.courseCode,
      courseName: c.courseName,
      total,
      completed: total,
      passed,
      failed: Number(c.failed),
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      avgScore: c.avgScore ? Math.round(Number(c.avgScore)) : null,
    };
  });

  const intakePerformanceRaw = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      total: sql<number>`count(*)`,
      completed: sql<number>`sum(case when ${enrollments.status} = 'completed' then 1 else 0 end)`,
      passed: sql<number>`sum(case when ${enrollments.grade} != 'F' and ${enrollments.grade} is not null then 1 else 0 end)`,
      avgScore: sql<number>`avg(cast(${enrollments.averageMarks} as numeric))`,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .innerJoin(enrollments, eq(courseIntakes.intakeId, enrollments.intakeId))
    .where(baseConditions.length ? and(...baseConditions) : undefined)
    .groupBy(
      courseIntakes.intakeId,
      courseIntakes.intakeNumber,
      courseIntakes.year,
      courses.courseCode,
      courses.courseName
    )
    .orderBy(desc(courseIntakes.year), courseIntakes.intakeNumber)
    .limit(20);

  const intakePerformance: IntakePerformanceRow[] = intakePerformanceRaw.map((i) => {
    const completed = Number(i.completed);
    const passed = Number(i.passed);
    return {
      intakeId: i.intakeId,
      intakeNumber: i.intakeNumber,
      year: i.year,
      courseCode: i.courseCode,
      courseName: i.courseName,
      total: Number(i.total),
      completed,
      passRate: completed > 0 ? Math.round((passed / completed) * 100) : 0,
      avgScore: i.avgScore ? Math.round(Number(i.avgScore)) : null,
    };
  });

  const subjectWhere = baseConditions.length ? and(...baseConditions) : undefined;

  const subjectAnalysisRaw = await db
    .select({
      subjectName: results.subjectName,
      attempts: sql<number>`count(*)`,
      avgPct: sql<number>`avg(cast(${results.marksObtained} as numeric) / nullif(cast(${results.maxMarks} as numeric), 0) * 100)`,
      passed: sql<number>`sum(case when cast(${results.marksObtained} as numeric) / nullif(cast(${results.maxMarks} as numeric), 0) * 100 >= 55 then 1 else 0 end)`,
    })
    .from(results)
    .innerJoin(enrollments, eq(results.enrollmentId, enrollments.enrollmentId))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(subjectWhere)
    .groupBy(results.subjectName)
    .orderBy(sql`avg(cast(${results.marksObtained} as numeric) / nullif(cast(${results.maxMarks} as numeric), 0) * 100)`)
    .limit(15);

  const subjectAnalysis: SubjectAnalysisRow[] = subjectAnalysisRaw.map((s) => {
    const attempts = Number(s.attempts);
    const passed = Number(s.passed);
    return {
      subjectName: s.subjectName,
      attempts,
      avgPercentage: s.avgPct ? Math.round(Number(s.avgPct)) : 0,
      passRate: attempts > 0 ? Math.round((passed / attempts) * 100) : 0,
    };
  });

  const monthlyEnrollments: MonthlyRow[] = [];
  const monthlyYear = filters.year ?? filterYear;

  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(monthlyYear, m, 1);
    const monthEnd = new Date(monthlyYear, m + 1, 0, 23, 59, 59);

    const monthConditions = [
      ...enrollmentJoinConditions({ ...filters, year: monthlyYear }),
      sql`${enrollments.createdAt} >= ${monthStart.toISOString()}`,
      sql`${enrollments.createdAt} <= ${monthEnd.toISOString()}`,
    ];
    if (filters.courseId) {
      // year already in conditions via enrollmentJoinConditions
    }

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
      .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
      .where(and(...monthConditions));

    monthlyEnrollments.push({
      month: MONTHS[m],
      enrollments: Number(row?.count ?? 0),
    });
  }

  return {
    filters: {
      years: yearRows.map((r) => r.year),
      courses: courseRows,
      selectedYear: filters.year,
      selectedCourseId: filters.courseId,
    },
    kpis: {
      totalStudents: {
        value: Number(studentCount.count),
        label: "Active Students",
      },
      totalEnrollments: {
        value: filteredStats.total,
        label: "Total Enrollments",
        change: pctChange(yearStats.total, prevYearStats.total),
      },
      completed: {
        value: yearStats.completed,
        label: `Completed (${filterYear})`,
        change: pctChange(yearStats.completed, prevYearStats.completed),
      },
      passRate: {
        value: filteredStats.passRate,
        label: "Pass Rate",
        suffix: "%",
        change: pctChange(filteredStats.passRate, prevYearStats.passRate),
      },
      avgScore: {
        value: filteredStats.avgScore ?? 0,
        label: "Average Score",
        suffix: "%",
        change:
          filteredStats.avgScore !== null && prevYearStats.avgScore !== null
            ? pctChange(filteredStats.avgScore, prevYearStats.avgScore)
            : null,
      },
      failed: {
        value: filteredStats.failed,
        label: "Failed",
        change: pctChange(filteredStats.failed, prevYearStats.failed),
      },
      atRisk: {
        value: filteredStats.atRisk,
        label: "At Risk",
        change: pctChange(filteredStats.atRisk, prevYearStats.atRisk),
      },
    },
    gradeDistribution: gradeChartData,
    enrollmentTrend,
    statusBreakdown,
    coursePerformance,
    intakePerformance,
    subjectAnalysis,
    monthlyEnrollments,
  };
}
