export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  enrollments,
  students,
  courses,
  courseIntakes,
  results,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { GradeBadge } from "@/components/grade-badge";
import { PositionBadge } from "@/components/position-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { studentPath } from "@/lib/utils";

export default async function EnrollmentDetailPage({
  params,
}: {
  params: Promise<{ enrollment_id: string }>;
}) {
  const { enrollment_id } = await params;
  const enrollmentId = parseInt(enrollment_id);

  const enrollmentData = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      studentArmyNumber: enrollments.studentArmyNumber,
      fullName: students.fullName,
      rank: students.rank,
      intakeId: enrollments.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      status: enrollments.status,
      totalMarks: enrollments.totalMarks,
      averageMarks: enrollments.averageMarks,
      grade: enrollments.grade,
      position: enrollments.position,
      createdAt: enrollments.createdAt,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(enrollments.enrollmentId, enrollmentId));

  const enrollment = enrollmentData[0];
  if (!enrollment) notFound();

  const enrollmentResults = await db
    .select({
      resultId: results.resultId,
      subjectName: results.subjectName,
      marksObtained: results.marksObtained,
      maxMarks: results.maxMarks,
      grade: results.grade,
      remarks: results.remarks,
      createdAt: results.createdAt,
    })
    .from(results)
    .where(eq(results.enrollmentId, enrollmentId))
    .orderBy(results.subjectName);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Enrollment #${enrollment.enrollmentId}`}
        description={`${enrollment.rank} ${enrollment.fullName} — ${enrollment.courseCode}`}
      >
        <PrintButton
          title={`Enrollment #${enrollment.enrollmentId} — ${enrollment.courseCode}`}
        />
        <Button variant="outline" asChild>
          <Link href="/enrollments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground">Student</dt>
                <dd>
                  <Link
                    href={studentPath(enrollment.studentArmyNumber)}
                    className="hover:underline"
                  >
                    {enrollment.rank} {enrollment.fullName}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  Army Number
                </dt>
                <dd className="font-mono">{enrollment.studentArmyNumber}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Course</dt>
                <dd>
                  <Link
                    href={`/courses/${enrollment.courseId}`}
                    className="hover:underline"
                  >
                    {enrollment.courseCode} — {enrollment.courseName}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Intake</dt>
                <dd>
                  <Link
                    href={`/intakes/${enrollment.intakeId}`}
                    className="hover:underline"
                  >
                    {enrollment.intakeNumber}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={enrollment.status ?? "enrolled"} />
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  Enrolled Date
                </dt>
                <dd>{new Date(enrollment.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground">
                  Total Marks
                </dt>
                <dd className="text-lg font-semibold">
                  {enrollment.totalMarks ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  Average Marks
                </dt>
                <dd className="text-lg font-semibold">
                  {enrollment.averageMarks
                    ? `${parseFloat(enrollment.averageMarks).toFixed(1)}%`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Grade</dt>
                <dd>
                  {enrollment.grade ? (
                    <GradeBadge grade={enrollment.grade as any} />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  Position in Class
                </dt>
                <dd>
                  {enrollment.position != null ? (
                    <PositionBadge position={enrollment.position} />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Results ({enrollmentResults.length})</CardTitle>
          <Button asChild size="sm">
            <Link href={`/results/new?enrollmentId=${enrollmentId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Result
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {enrollmentResults.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No results recorded for this enrollment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollmentResults.map((r) => {
                  const percentage =
                    Number(r.maxMarks) > 0
                      ? (Number(r.marksObtained) / Number(r.maxMarks)) * 100
                      : 0;
                  return (
                    <TableRow key={r.resultId}>
                      <TableCell className="font-medium">
                        {r.subjectName}
                      </TableCell>
                      <TableCell>
                        {r.marksObtained}/{r.maxMarks}
                      </TableCell>
                      <TableCell>{percentage.toFixed(1)}%</TableCell>
                      <TableCell>
                        {r.grade ? <GradeBadge grade={r.grade as any} /> : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.remarks ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
