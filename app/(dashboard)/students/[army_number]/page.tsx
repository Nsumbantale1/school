export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  students,
  enrollments,
  courseIntakes,
  courses,
  results,
} from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradeBadge } from "@/components/grade-badge";
import { PositionBadge } from "@/components/position-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, User, Phone, Mail, Building, Calendar, FileText } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canManageStudents } from "@/lib/auth/guards";
import { decodeArmyNumber, studentPath } from "@/lib/utils";
import { BackButton } from "@/components/back-button";
import { PrintButton } from "@/components/print-button";
import { FinalCourseReport } from "./_components/final-course-report";
import { parseBccResults } from "@/lib/utils/bcc-report";
import { getStudentPhotoPath } from "@/lib/utils/student-photo";

interface PageProps {
  params: Promise<{ army_number: string }>;
}

export default async function StudentDetailPage({ params }: PageProps) {
  const { army_number: rawArmyNumber } = await params;
  const army_number = decodeArmyNumber(rawArmyNumber);
  const user = await getSessionUser();

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.armyNumber, army_number))
    .limit(1);

  if (!student) {
    notFound();
  }

  const photoPath = await getStudentPhotoPath(army_number);

  const studentEnrollments = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      status: enrollments.status,
      rankAtEnrollment: enrollments.rankAtEnrollment,
      unitAtEnrollment: enrollments.unitAtEnrollment,
      totalMarks: enrollments.totalMarks,
      averageMarks: enrollments.averageMarks,
      grade: enrollments.grade,
      position: enrollments.position,
      intakeId: enrollments.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      startDate: courseIntakes.startDate,
      endDate: courseIntakes.endDate,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(enrollments.studentArmyNumber, army_number))
    .orderBy(courseIntakes.year);

  const enrollmentIds = studentEnrollments.map((e) => e.enrollmentId);

  const allResults =
    enrollmentIds.length > 0
      ? await db
          .select({
            resultId: results.resultId,
            enrollmentId: results.enrollmentId,
            subjectName: results.subjectName,
            marksObtained: results.marksObtained,
            maxMarks: results.maxMarks,
            grade: results.grade,
            remarks: results.remarks,
          })
          .from(results)
          .where(inArray(results.enrollmentId, enrollmentIds))
          .orderBy(results.resultId)
      : [];

  const resultsByEnrollment = new Map<number, typeof allResults>();
  for (const result of allResults) {
    const list = resultsByEnrollment.get(result.enrollmentId) ?? [];
    list.push(result);
    resultsByEnrollment.set(result.enrollmentId, list);
  }

  const reportByEnrollment = new Map(
    studentEnrollments.map((enrollment) => [
      enrollment.enrollmentId,
      parseBccResults(resultsByEnrollment.get(enrollment.enrollmentId) ?? []),
    ])
  );

  const reportIntakeIds = [
    ...new Set(
      studentEnrollments
        .filter((e) => reportByEnrollment.get(e.enrollmentId))
        .map((e) => e.intakeId)
    ),
  ];
  const classSizeByIntake = new Map<number, number>();
  for (const intakeId of reportIntakeIds) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(enrollments)
      .where(eq(enrollments.intakeId, intakeId));
    classSizeByIntake.set(intakeId, Number(row?.n ?? 0));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${student.rank} ${student.fullName}`}
        description={`Army Number: ${student.armyNumber} · Current rank`}
      >
        <PrintButton
          title={`Final Course Report — ${student.rank} ${student.fullName}`}
        />
        <Button variant="default" asChild>
          <Link href={studentPath(army_number, "/service-record")}>
            <FileText className="mr-2 h-4 w-4" />
            Training Record
          </Link>
        </Button>
        {user && canManageStudents(user.role) && (
          <Button asChild>
            <Link href={studentPath(army_number, "/edit")}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
        <BackButton fallbackHref="/students" />
      </PageHeader>

      {studentEnrollments.map((enrollment) => {
        const report = reportByEnrollment.get(enrollment.enrollmentId);
        if (!report) return null;
        return (
          <FinalCourseReport
            key={`bcc-${enrollment.enrollmentId}`}
            forceNo={student.armyNumber}
            rank={enrollment.rankAtEnrollment}
            fullName={student.fullName}
            unit={enrollment.unitAtEnrollment ?? student.unit}
            courseCode={enrollment.courseCode}
            courseName={enrollment.courseName}
            intakeNumber={enrollment.intakeNumber}
            commenced={enrollment.startDate}
            completed={enrollment.endDate}
            position={enrollment.position}
            classSize={classSizeByIntake.get(enrollment.intakeId) ?? null}
            enrollmentHref={`/enrollments/${enrollment.enrollmentId}`}
            photoPath={photoPath}
            report={report}
          />
        );
      })}

      <div className="grid gap-6 md:grid-cols-2 print:hidden">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {photoPath && (
              <img
                src={photoPath}
                alt={student.fullName}
                className="h-36 w-28 rounded-md object-cover border"
              />
            )}
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
              <span className="text-muted-foreground">Current Rank</span>
              <span className="font-medium">{student.rank}</span>
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
              <span className="text-muted-foreground">Subject Results</span>
              <span className="font-medium">{allResults.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="print:hidden">
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
                    <th className="text-left py-3 px-2 font-medium">Rank then</th>
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
                        <Link
                          href={`/enrollments/${enrollment.enrollmentId}`}
                          className="hover:underline"
                        >
                          <p className="font-medium">{enrollment.courseName}</p>
                          <p className="text-sm text-muted-foreground">
                            {enrollment.courseCode}
                          </p>
                        </Link>
                      </td>
                      <td className="py-3 px-2">
                        <span className="font-medium">{enrollment.rankAtEnrollment}</span>
                        {enrollment.rankAtEnrollment !== student.rank && (
                          <p className="text-xs text-muted-foreground">
                            now {student.rank}
                          </p>
                        )}
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

      {studentEnrollments.map((enrollment) => {
        if (reportByEnrollment.get(enrollment.enrollmentId)) return null;
        const subjectResults =
          resultsByEnrollment.get(enrollment.enrollmentId) ?? [];
        return (
          <Card key={`results-${enrollment.enrollmentId}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">
                  Subject Marks — {enrollment.courseCode}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {enrollment.courseName} · {enrollment.intakeNumber} (
                  {enrollment.year}) · Rank: {enrollment.rankAtEnrollment}
                  {enrollment.unitAtEnrollment
                    ? ` · ${enrollment.unitAtEnrollment}`
                    : ""}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/enrollments/${enrollment.enrollmentId}`}>
                  Open enrollment
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {subjectResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No subject marks recorded for this course yet.
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
                    {subjectResults.map((r) => {
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
                            <GradeBadge grade={r.grade} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {r.remarks || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
