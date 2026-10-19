export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import {
  students,
  courses,
  enrollments,
  courseIntakes,
  type Grade,
} from "@/lib/db/schema";
import { eq, count, desc, and, gte } from "drizzle-orm";
import {
  Users,
  BookOpen,
  ClipboardList,
  Calendar,
  CalendarDays,
  Trophy,
  TrendingUp,
  UserPlus,
  CalendarPlus,
  PenLine,
  Presentation,
  FileBarChart,
  ArrowRight,
  Award,
  FileText,
} from "lucide-react";
import Image from "next/image";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { displayName } from "@/lib/utils/display-name";
import { GradeBadge } from "@/components/grade-badge";
import { getSessionUser } from "@/lib/auth";
import { studentPath } from "@/lib/utils";
import { formatIntakeLabel } from "@/lib/utils/intake-label";
import { getCourseDisplayMeta } from "@/lib/utils/course-catalog";
import {
  currentTrainingMonth,
  trainingMonths,
  trainingWeekStatus,
} from "@/lib/utils/training-week";

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
    weeklyIntakes,
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
        rank: enrollments.rankAtEnrollment,
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
        rank: enrollments.rankAtEnrollment,
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
    db
      .select({
        intakeId: courseIntakes.intakeId,
        intakeNumber: courseIntakes.intakeNumber,
        year: courseIntakes.year,
        startDate: courseIntakes.startDate,
        endDate: courseIntakes.endDate,
        courseCode: courses.courseCode,
        courseName: courses.courseName,
        durationWeeks: courses.durationWeeks,
      })
      .from(courseIntakes)
      .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
      .where(
        and(
          eq(courseIntakes.isActive, true),
          eq(courses.isActive, true),
          gte(courseIntakes.year, currentYear - 1)
        )
      ),
  ]);

  const thisWeek = weeklyIntakes
    .flatMap((intake) => {
      const status = trainingWeekStatus({
        startDate: intake.startDate,
        endDate: intake.endDate,
        durationWeeks: intake.durationWeeks,
      });
      if (status.phase !== "current") return [];
      const meta = getCourseDisplayMeta(intake.courseCode, intake.courseName);
      const totalMonths = trainingMonths(intake.durationWeeks);
      return [
        {
          intakeId: intake.intakeId,
          title: meta.label,
          intakeLabel: formatIntakeLabel({
            intakeNumber: intake.intakeNumber,
            startDate: intake.startDate,
            endDate: intake.endDate,
            year: intake.year,
          }),
          week: status.week,
          totalWeeks: status.totalWeeks,
          month: currentTrainingMonth(status.week, totalMonths, status.phase),
          totalMonths,
        },
      ];
    })
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, 6);

  const totalStudents = studentCount[0]?.count ?? 0;
  const totalCourses = activeCourses[0]?.count ?? 0;
  const enrollCount = activeEnrollments[0]?.count ?? 0;
  const intakeCount = totalIntakes[0]?.count ?? 0;

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const featured = ["admin", "chief_instructor", "commandant"].includes(user?.role ?? "")
    ? { label: "Certificates", href: "/certificates", icon: FileText }
    : { label: "Results", href: "/results", icon: Award };

  const quickActions = [
    ...(user?.role === "admin"
      ? [
          { label: "Add Student", href: "/students/new", icon: UserPlus },
          { label: "Add Course", href: "/courses/new", icon: BookOpen },
          { label: "Create Intake", href: "/intakes/new", icon: CalendarPlus },
          { label: "New Enrollment", href: "/enrollments/new", icon: ClipboardList },
        ]
      : []),
    ...(user?.role === "admin" || user?.role === "instructor"
      ? [{ label: "Enter Results", href: "/results/new", icon: PenLine }]
      : []),
    { label: "Weekly & Monthly Test", href: "/weekly", icon: CalendarDays },
    { label: "Presentations", href: "/presentations", icon: Presentation },
    { label: "Reports", href: "/reports", icon: FileBarChart },
    { label: "Analytics", href: "/analytics", icon: TrendingUp },
  ];

  return (
    <div className="space-y-8">
      <section className="bg-command-hero relative overflow-hidden rounded-2xl p-6 text-white shadow-lg md:p-8">
        <div className="bg-command-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-5">
            <div className="hidden size-20 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-lg ring-4 ring-white/10 sm:flex">
              <Image
                src="/school-of-artillery.png"
                alt="School of Artillery crest"
                width={80}
                height={62}
                className="h-auto w-full"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-highlight">
                {today}
              </p>
              <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
                {greeting}, {user?.name ?? "User"}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-white/70">
                School of Field Artillery training records — students, courses, intakes and results in one place.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild className="bg-highlight text-highlight-foreground shadow-md hover:bg-highlight/90">
              <Link href="/students">
                <Users className="h-4 w-4" />
                Students
              </Link>
            </Button>
            <Button asChild variant="maroon" className="shadow-md ring-1 ring-white/15">
              <Link href={featured.href}>
                <featured.icon className="h-4 w-4" />
                {featured.label}
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href="/reports">
                <FileBarChart className="h-4 w-4" />
                Reports
              </Link>
            </Button>
          </div>
        </div>
        <span className="bg-regimental-ribbon absolute inset-x-0 bottom-0 h-1.5" />
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Students" value={totalStudents} description="Active in system" icon={Users} tone="primary" />
        <StatCard title="Active Courses" value={totalCourses} description="Currently offered" icon={BookOpen} tone="highlight" />
        <StatCard title="Intakes This Year" value={intakeCount} description={`Opened in ${currentYear}`} icon={Calendar} tone="blue" />
        <StatCard title="Active Enrollments" value={enrollCount} description="Currently enrolled" icon={ClipboardList} tone="maroon" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div>
            <CardTitle className="flex items-center gap-2 font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" />
              Weekly & Monthly Test
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Current weekly test and monthly test for running intakes
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-primary">
            <Link href="/weekly">
              Open tests <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-2">
          {thisWeek.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No intake is in a training week right now.
            </p>
          ) : (
            <ul className="divide-y">
              {thisWeek.map((item) => (
                <li key={item.intakeId}>
                  <Link
                    href={`/weekly/${item.intakeId}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent/50"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {item.week}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Intake {item.intakeLabel}
                      </p>
                    </div>
                    <span className="text-right text-xs tabular-nums text-muted-foreground">
                      Week {item.week}/{item.totalWeeks}
                      {item.totalMonths > 0 && (
                        <span className="block">
                          M-{item.month}/{item.totalMonths}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <div>
              <CardTitle className="font-semibold">Recent Enrollments</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Latest students added to intakes</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-primary">
              <Link href="/enrollments">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-2">
            {recentEnrollments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No enrollments yet.</p>
            ) : (
              <ul className="divide-y">
                {recentEnrollments.map((e) => (
                  <li key={e.enrollmentId}>
                    <Link
                      href={studentPath(e.studentArmyNumber)}
                      className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent/50"
                    >
                      <Avatar name={e.fullName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {e.rank} {displayName(e.fullName, e.courseCode)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.courseCode} · Intake {e.intakeNumber}
                        </p>
                      </div>
                      <StatusBadge status={e.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <div>
              <CardTitle className="flex items-center gap-2 font-semibold">
                <Trophy className="h-4 w-4 text-highlight-deep" />
                Top Performers
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Course leaders in {currentYear}</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-primary">
              <Link href="/reports/top-performers">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-2">
            {topPerformers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No top performers yet this year.</p>
            ) : (
              <ul className="divide-y">
                {topPerformers.map((p, i) => (
                  <li key={p.enrollmentId}>
                    <Link
                      href={studentPath(p.studentArmyNumber)}
                      className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent/50"
                    >
                      <span
                        className={
                          "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                          (i === 0
                            ? "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-sm"
                            : i === 1
                              ? "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800"
                              : i === 2
                                ? "bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950"
                                : "bg-muted text-muted-foreground")
                        }
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {p.rank} {displayName(p.fullName, p.courseCode)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{p.courseCode}</p>
                      </div>
                      <span className="font-[family-name:var(--font-display)] text-sm font-semibold tabular-nums">
                        {p.averageMarks ? `${parseFloat(p.averageMarks).toFixed(1)}%` : "N/A"}
                      </span>
                      <GradeBadge grade={p.grade as Grade | null} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group flex flex-col items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <a.icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length
    ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
    : "?";
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
      {letters}
    </span>
  );
}
