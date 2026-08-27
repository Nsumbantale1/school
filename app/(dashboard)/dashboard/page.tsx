export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import {
  students,
  courses,
  enrollments,
  courseIntakes,
} from "@/lib/db/schema";
import { eq, count, desc, and, sql } from "drizzle-orm";
import {
  Users,
  BookOpen,
  ClipboardList,
  Calendar,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { GradeBadge } from "@/components/grade-badge";
import { getSessionUser } from "@/lib/auth";
import { studentPath } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await getSessionUser();
  const currentYear = new Date().getFullYear();

  const [
    studentCount,
    activeCourses,
    activeEnrollments,
    totalIntakes,
    recentEnrollments,
    topPerformers,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(students)
      .where(eq(students.isActive, true)),
    db
      .select({ count: count() })
      .from(courses)
      .where(eq(courses.isActive, true)),
    db
      .select({ count: count() })
      .from(enrollments)
      .where(eq(enrollments.status, "enrolled")),
    db
      .select({ count: count() })
      .from(courseIntakes)
      .where(eq(courseIntakes.year, currentYear)),
    // Recent enrollments with details
    db
      .select({
        enrollmentId: enrollments.enrollmentId,
        studentArmyNumber: students.armyNumber,
        fullName: students.fullName,
        rank: students.rank,
        courseCode: courses.courseCode,
        intakeNumber: courseIntakes.intakeNumber,
        status: enrollments.status,
        createdAt: enrollments.createdAt,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
      .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
      .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
      .orderBy(desc(enrollments.createdAt))
      .limit(5),
    // Top performers this year
    db
      .select({
        enrollmentId: enrollments.enrollmentId,
        studentArmyNumber: students.armyNumber,
        fullName: students.fullName,
        rank: students.rank,
        courseCode: courses.courseCode,
        averageMarks: enrollments.averageMarks,
        grade: enrollments.grade,
        position: enrollments.position,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
      .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
      .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
      .where(
        and(
          eq(courseIntakes.year, currentYear),
          eq(enrollments.position, 1)
        )
      )
      .orderBy(desc(enrollments.averageMarks))
      .limit(5),
  ]);

  const totalStudents = studentCount[0]?.count ?? 0;
  const totalCourses = activeCourses[0]?.count ?? 0;
  const enrollCount = activeEnrollments[0]?.count ?? 0;
  const intakeCount = totalIntakes[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.name ?? "User"}`}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={totalStudents}
          description="Active in system"
          icon={Users}
        />
        <StatCard
          title="Active Courses"
          value={totalCourses}
          description="Currently offered"
          icon={BookOpen}
        />
        <StatCard
          title="Intakes This Year"
          value={intakeCount}
          description={`In ${currentYear}`}
          icon={Calendar}
        />
        <StatCard
          title="Active Enrollments"
          value={enrollCount}
          description="Currently enrolled"
          icon={ClipboardList}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Enrollments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Enrollments</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/enrollments">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentEnrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No enrollments yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentEnrollments.map((e) => (
                  <Link
                    key={e.enrollmentId}
                    href={studentPath(e.studentArmyNumber)}
                    className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted transition-colors"
                  >
                    <div>
                      <span className="font-medium">
                        {e.rank} {e.fullName}
                      </span>
                      <p className="text-muted-foreground text-xs">
                        {e.courseCode} - {e.intakeNumber}
                      </p>
                    </div>
                    <StatusBadge status={e.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top Performers ({currentYear})
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/reports/top-performers">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {topPerformers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No top performers yet this year.
              </p>
            ) : (
              <div className="space-y-3">
                {topPerformers.map((p) => (
                  <Link
                    key={p.enrollmentId}
                    href={studentPath(p.studentArmyNumber)}
                    className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted transition-colors"
                  >
                    <div>
                      <span className="font-medium">
                        {p.rank} {p.fullName}
                      </span>
                      <p className="text-muted-foreground text-xs">
                        {p.courseCode} -{" "}
                        {p.averageMarks
                          ? `${parseFloat(p.averageMarks).toFixed(1)}%`
                          : "N/A"}
                      </p>
                    </div>
                    <GradeBadge grade={p.grade as any} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {user?.role === "admin" && (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href="/students/new">Add Student</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/courses/new">Add Course</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/intakes/new">Create Intake</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/enrollments/new">New Enrollment</Link>
                </Button>
              </>
            )}
            {(user?.role === "admin" || user?.role === "instructor") && (
              <Button asChild variant="outline" size="sm">
                <Link href="/results/new">Enter Results</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/reports">View Reports</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/analytics">
                <TrendingUp className="mr-2 h-4 w-4" />
                Analytics
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
