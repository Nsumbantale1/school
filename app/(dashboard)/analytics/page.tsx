export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  students,
  enrollments,
  courses,
  courseIntakes,
} from "@/lib/db/schema";
import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import {
  GradeDistributionChart,
  EnrollmentTrendChart,
  CoursePerformanceChart,
  StatsOverview,
} from "@/components/analytics-charts";

export default async function AnalyticsPage() {
  const currentYear = new Date().getFullYear();

  // Get overall stats
  const [studentCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(students)
    .where(eq(students.isActive, true));

  const [activeEnrollmentCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.status, "enrolled"));

  const [completedThisYearCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .where(
      and(
        eq(enrollments.status, "completed"),
        eq(courseIntakes.year, currentYear)
      )
    );

  // Calculate average pass rate
  const passRateData = await db
    .select({
      total: sql<number>`count(*)`,
      passed: sql<number>`sum(case when grade != 'F' and grade is not null then 1 else 0 end)`,
    })
    .from(enrollments)
    .where(eq(enrollments.status, "completed"));

  const avgPassRate =
    passRateData[0].total > 0
      ? Math.round((Number(passRateData[0].passed) / Number(passRateData[0].total)) * 100)
      : 0;

  // Grade distribution
  const gradeDistribution = await db
    .select({
      grade: enrollments.grade,
      count: sql<number>`count(*)`,
    })
    .from(enrollments)
    .where(eq(enrollments.status, "completed"))
    .groupBy(enrollments.grade);

  const totalGraded = gradeDistribution.reduce((sum, g) => sum + Number(g.count), 0);
  const gradeChartData = ["A", "B", "C", "D", "F"].map((grade) => {
    const found = gradeDistribution.find((g) => g.grade === grade);
    const count = found ? Number(found.count) : 0;
    return {
      grade,
      count,
      percentage: totalGraded > 0 ? (count / totalGraded) * 100 : 0,
    };
  });

  // Enrollment trend (5 years)
  const fiveYearsAgo = currentYear - 4;
  const enrollmentTrend = [];

  for (let year = fiveYearsAgo; year <= currentYear; year++) {
    const [yearEnrollments] = await db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
      .where(eq(courseIntakes.year, year));

    const [yearCompletions] = await db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
      .where(
        and(
          eq(courseIntakes.year, year),
          eq(enrollments.status, "completed")
        )
      );

    enrollmentTrend.push({
      year,
      enrollments: Number(yearEnrollments.count),
      completions: Number(yearCompletions.count),
    });
  }

  // Course performance (pass rates per course)
  const coursePerformance = await db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      total: sql<number>`count(*)`,
      passed: sql<number>`sum(case when ${enrollments.grade} != 'F' and ${enrollments.grade} is not null then 1 else 0 end)`,
      avgScore: sql<number>`avg(cast(${enrollments.averageMarks} as numeric))`,
    })
    .from(courses)
    .innerJoin(courseIntakes, eq(courses.courseId, courseIntakes.courseId))
    .innerJoin(enrollments, eq(courseIntakes.intakeId, enrollments.intakeId))
    .where(eq(enrollments.status, "completed"))
    .groupBy(courses.courseId, courses.courseCode, courses.courseName)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const courseChartData = coursePerformance.map((c) => ({
    courseCode: c.courseCode,
    courseName: c.courseName,
    passRate: c.total > 0 ? Math.round((Number(c.passed) / Number(c.total)) * 100) : 0,
    averageScore: c.avgScore ? Math.round(Number(c.avgScore)) : 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Overview of performance metrics and trends"
      />

      {/* Stats Overview */}
      <StatsOverview
        stats={{
          totalStudents: Number(studentCount.count),
          activeEnrollments: Number(activeEnrollmentCount.count),
          completedCourses: Number(completedThisYearCount.count),
          averagePassRate: avgPassRate,
        }}
      />

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <GradeDistributionChart data={gradeChartData} />
        <EnrollmentTrendChart data={enrollmentTrend} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6">
        <CoursePerformanceChart data={courseChartData} />
      </div>
    </div>
  );
}
