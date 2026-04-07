export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { students, enrollments, courseIntakes, courses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradeBadge } from "@/components/grade-badge";
import { PositionBadge } from "@/components/position-badge";
import { StatusBadge } from "@/components/status-badge";
import { Pencil, User, Phone, Mail, Building, Calendar } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canManageStudents } from "@/lib/auth/guards";

interface PageProps {
  params: Promise<{ army_number: string }>;
}

export default async function StudentDetailPage({ params }: PageProps) {
  const { army_number } = await params;
  const user = await getSessionUser();

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.armyNumber, army_number))
    .limit(1);

  if (!student) {
    notFound();
  }

  // Get student's enrollments with course details
  const studentEnrollments = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      status: enrollments.status,
      totalMarks: enrollments.totalMarks,
      averageMarks: enrollments.averageMarks,
      grade: enrollments.grade,
      position: enrollments.position,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(enrollments.studentArmyNumber, army_number))
    .orderBy(courseIntakes.year);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${student.rank} ${student.fullName}`}
        description={`Army Number: ${student.armyNumber}`}
      >
        {user && canManageStudents(user.role) && (
          <Button asChild>
            <Link href={`/students/${army_number}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Gender</p>
                <p className="capitalize">{student.gender}</p>
              </div>
            </div>

            {student.dateOfBirth && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p>{new Date(student.dateOfBirth).toLocaleDateString()}</p>
                </div>
              </div>
            )}

            {student.unit && (
              <div className="flex items-center gap-3">
                <Building className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Unit</p>
                  <p>{student.unit}</p>
                </div>
              </div>
            )}

            {student.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p>{student.phone}</p>
                </div>
              </div>
            )}

            {student.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p>{student.email}</p>
                </div>
              </div>
            )}

            {student.notes && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{student.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active</span>
              <Badge variant={student.isActive ? "default" : "secondary"}>
                {student.isActive ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Courses</span>
              <span className="font-medium">{studentEnrollments.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-medium">
                {studentEnrollments.filter((e) => e.status === "completed").length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">In Progress</span>
              <span className="font-medium">
                {
                  studentEnrollments.filter(
                    (e) => e.status === "enrolled" || e.status === "in_progress"
                  ).length
                }
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Course History</CardTitle>
        </CardHeader>
        <CardContent>
          {studentEnrollments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No course enrollments yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Course</th>
                    <th className="text-left py-3 px-2 font-medium">Intake</th>
                    <th className="text-left py-3 px-2 font-medium">Year</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-left py-3 px-2 font-medium">Average</th>
                    <th className="text-left py-3 px-2 font-medium">Grade</th>
                    <th className="text-left py-3 px-2 font-medium">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {studentEnrollments.map((enrollment) => (
                    <tr key={enrollment.enrollmentId} className="border-b">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{enrollment.courseName}</p>
                          <p className="text-sm text-muted-foreground">
                            {enrollment.courseCode}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-2">{enrollment.intakeNumber}</td>
                      <td className="py-3 px-2">{enrollment.year}</td>
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
                      <td className="py-3 px-2">
                        <PositionBadge position={enrollment.position} />
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
