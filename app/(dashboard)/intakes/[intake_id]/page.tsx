export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  courseIntakes,
  courses,
  enrollments,
  students,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradeBadge } from "@/components/grade-badge";
import { PositionBadge } from "@/components/position-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  Pencil,
  Calendar,
  User,
  Users,
  Plus,
  Trophy,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canManageIntakes, canManageEnrollments } from "@/lib/auth/guards";

interface PageProps {
  params: Promise<{ intake_id: string }>;
}

export default async function IntakeDetailPage({ params }: PageProps) {
  const { intake_id } = await params;
  const intakeId = parseInt(intake_id);
  const user = await getSessionUser();

  // Get intake with course info
  const [intake] = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      commanderName: courseIntakes.commanderName,
      coordinatorName: courseIntakes.coordinatorName,
      startDate: courseIntakes.startDate,
      endDate: courseIntakes.endDate,
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      passingMark: courses.passingMark,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);

  if (!intake) {
    notFound();
  }

  // Get enrolled students with their results
  const intakeEnrollments = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      status: enrollments.status,
      totalMarks: enrollments.totalMarks,
      averageMarks: enrollments.averageMarks,
      grade: enrollments.grade,
      position: enrollments.position,
      armyNumber: students.armyNumber,
      fullName: students.fullName,
      rank: students.rank,
      unit: students.unit,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .where(eq(enrollments.intakeId, intakeId))
    .orderBy(enrollments.position);

  // Calculate statistics
  const totalStudents = intakeEnrollments.length;
  const completedCount = intakeEnrollments.filter(
    (e) => e.status === "completed"
  ).length;
  const passedCount = intakeEnrollments.filter(
    (e) => e.grade && e.grade !== "F"
  ).length;
  const failedCount = intakeEnrollments.filter((e) => e.grade === "F").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${intake.courseName} - ${intake.intakeNumber}`}
        description={`${intake.courseCode} (${intake.year})`}
      >
        {user && canManageEnrollments(user.role) && (
          <Button asChild>
            <Link href={`/enrollments/new?intakeId=${intakeId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Enroll Student
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Intake Info Cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{passedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Intake Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intake Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p>
                  {new Date(intake.startDate).toLocaleDateString()} -{" "}
                  {intake.endDate
                    ? new Date(intake.endDate).toLocaleDateString()
                    : "Ongoing"}
                </p>
              </div>
            </div>

            {intake.commanderName && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Commander</p>
                  <p>{intake.commanderName}</p>
                </div>
              </div>
            )}

            {intake.coordinatorName && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Coordinator</p>
                  <p>{intake.coordinatorName}</p>
                </div>
              </div>
            )}

            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">Passing Mark</p>
              <p className="font-medium">{intake.passingMark}%</p>
            </div>
          </CardContent>
        </Card>

        {/* Course Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Course Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Course Code</p>
              <p className="font-mono">{intake.courseCode}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Course Name</p>
              <p>{intake.courseName}</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/courses/${intake.courseId}`}>View Course Details</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Enrolled Students */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrolled Students</CardTitle>
        </CardHeader>
        <CardContent>
          {intakeEnrollments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No students enrolled yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Position</th>
                    <th className="text-left py-3 px-2 font-medium">Student</th>
                    <th className="text-left py-3 px-2 font-medium">Army Number</th>
                    <th className="text-left py-3 px-2 font-medium">Unit</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-left py-3 px-2 font-medium">Average</th>
                    <th className="text-left py-3 px-2 font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {intakeEnrollments.map((enrollment) => (
                    <tr key={enrollment.enrollmentId} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <PositionBadge
                          position={enrollment.position}
                          totalStudents={totalStudents}
                        />
                      </td>
                      <td className="py-3 px-2">
                        <Link
                          href={`/enrollments/${enrollment.enrollmentId}`}
                          className="hover:underline"
                        >
                          <div>
                            <p className="font-medium">
                              {enrollment.rank} {enrollment.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              View subject marks
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 px-2 font-mono text-sm">
                        {enrollment.armyNumber}
                      </td>
                      <td className="py-3 px-2">{enrollment.unit ?? "—"}</td>
                      <td className="py-3 px-2">
                        <StatusBadge status={enrollment.status} />
                      </td>
                      <td className="py-3 px-2">
                        {enrollment.averageMarks
                          ? `${parseFloat(enrollment.averageMarks).toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="py-3 px-2">
                        <GradeBadge grade={enrollment.grade} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
