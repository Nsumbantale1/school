export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  courses,
  courseIntakes,
  coursePrerequisites,
  enrollments,
  students,
} from "@/lib/db/schema";
import { eq, count, desc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Clock, Target, Plus, UserPlus } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { BackButton } from "@/components/back-button";
import { getSessionUser } from "@/lib/auth";
import { canManageEnrollments } from "@/lib/auth/guards";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ course_id: string }>;
}) {
  const { course_id } = await params;
  const courseId = parseInt(course_id);
  const user = await getSessionUser();
  const canEnroll = user && canManageEnrollments(user.role);

  const course = await db.query.courses.findFirst({
    where: eq(courses.courseId, courseId),
  });
  if (!course) notFound();

  const [intakes, prerequisites, prerequisiteFor] = await Promise.all([
    // Get all intakes for this course
    db
      .select({
        intakeId: courseIntakes.intakeId,
        intakeNumber: courseIntakes.intakeNumber,
        year: courseIntakes.year,
        commanderName: courseIntakes.commanderName,
        coordinatorName: courseIntakes.coordinatorName,
        startDate: courseIntakes.startDate,
        endDate: courseIntakes.endDate,
        isActive: courseIntakes.isActive,
      })
      .from(courseIntakes)
      .where(eq(courseIntakes.courseId, courseId))
      .orderBy(desc(courseIntakes.year), desc(courseIntakes.intakeNumber)),

    // Get prerequisites for this course
    db
      .select({
        courseId: courses.courseId,
        courseCode: courses.courseCode,
        courseName: courses.courseName,
        isOptional: coursePrerequisites.isOptional,
      })
      .from(coursePrerequisites)
      .innerJoin(
        courses,
        eq(coursePrerequisites.prerequisiteCourseId, courses.courseId)
      )
      .where(eq(coursePrerequisites.courseId, courseId)),

    // Get courses that require this as a prerequisite
    db
      .select({
        courseId: courses.courseId,
        courseCode: courses.courseCode,
        courseName: courses.courseName,
        isOptional: coursePrerequisites.isOptional,
      })
      .from(coursePrerequisites)
      .innerJoin(courses, eq(coursePrerequisites.courseId, courses.courseId))
      .where(eq(coursePrerequisites.prerequisiteCourseId, courseId)),
  ]);

  // Get enrollment counts for each intake
  const intakeEnrollmentCounts = await Promise.all(
    intakes.map(async (intake) => {
      const result = await db
        .select({ count: count() })
        .from(enrollments)
        .where(eq(enrollments.intakeId, intake.intakeId));
      return { intakeId: intake.intakeId, count: result[0]?.count ?? 0 };
    })
  );

  const enrollmentCountMap: Record<number, number> = {};
  for (const ec of intakeEnrollmentCounts) {
    enrollmentCountMap[ec.intakeId] = ec.count;
  }

  const defaultIntake =
    intakes.find((i) => i.isActive) ?? intakes[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${course.courseCode} — ${course.courseName}`}
        description={course.description ?? "No description"}
      >
        <PrintButton title={`${course.courseCode} — ${course.courseName}`} />
        {canEnroll && defaultIntake && (
          <Button asChild>
            <Link
              href={`/enrollments/new?courseId=${courseId}&intakeId=${defaultIntake.intakeId}`}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Student
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href={`/courses/${courseId}/edit`}>Edit Course</Link>
        </Button>
        <BackButton fallbackHref="/courses" />
      </PageHeader>

      {/* Course Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">{course.durationWeeks} weeks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Passing Mark</p>
                <p className="font-medium">{course.passingMark}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Intakes</p>
                <p className="font-medium">{intakes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="intakes">
        <TabsList>
          <TabsTrigger value="intakes">Intakes ({intakes.length})</TabsTrigger>
          <TabsTrigger value="prerequisites">
            Prerequisites ({prerequisites.length})
          </TabsTrigger>
          <TabsTrigger value="prerequisite-for">
            Required For ({prerequisiteFor.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intakes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Course Intakes</CardTitle>
              <Button asChild size="sm">
                <Link href={`/intakes/new?courseId=${courseId}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Intake
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {intakes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No intakes created for this course yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Intake Number</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Commander</TableHead>
                      <TableHead>Coordinator</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Status</TableHead>
                      {canEnroll && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {intakes.map((intake) => (
                      <TableRow key={intake.intakeId}>
                        <TableCell>
                          <Link
                            href={`/intakes/${intake.intakeId}`}
                            className="font-medium hover:underline"
                          >
                            {intake.intakeNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{intake.year}</TableCell>
                        <TableCell>{intake.commanderName ?? "—"}</TableCell>
                        <TableCell>{intake.coordinatorName ?? "—"}</TableCell>
                        <TableCell className="text-sm">
                          {intake.startDate} — {intake.endDate ?? "Ongoing"}
                        </TableCell>
                        <TableCell>
                          {enrollmentCountMap[intake.intakeId] ?? 0}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={intake.isActive ? "default" : "secondary"}
                          >
                            {intake.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        {canEnroll && (
                          <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                              <Link
                                href={`/enrollments/new?courseId=${courseId}&intakeId=${intake.intakeId}`}
                              >
                                <UserPlus className="mr-1 h-3 w-3" />
                                Add Student
                              </Link>
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prerequisites">
          <Card>
            <CardHeader>
              <CardTitle>Course Prerequisites</CardTitle>
            </CardHeader>
            <CardContent>
              {prerequisites.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  This course has no prerequisites.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course Code</TableHead>
                      <TableHead>Course Name</TableHead>
                      <TableHead>Requirement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prerequisites.map((p) => (
                      <TableRow key={p.courseId}>
                        <TableCell>
                          <Link
                            href={`/courses/${p.courseId}`}
                            className="font-medium hover:underline"
                          >
                            {p.courseCode}
                          </Link>
                        </TableCell>
                        <TableCell>{p.courseName}</TableCell>
                        <TableCell>
                          <Badge variant={p.isOptional ? "outline" : "default"}>
                            {p.isOptional ? "Optional" : "Required"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prerequisite-for">
          <Card>
            <CardHeader>
              <CardTitle>Courses Requiring This Course</CardTitle>
            </CardHeader>
            <CardContent>
              {prerequisiteFor.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No courses require this as a prerequisite.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course Code</TableHead>
                      <TableHead>Course Name</TableHead>
                      <TableHead>Requirement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prerequisiteFor.map((p) => (
                      <TableRow key={p.courseId}>
                        <TableCell>
                          <Link
                            href={`/courses/${p.courseId}`}
                            className="font-medium hover:underline"
                          >
                            {p.courseCode}
                          </Link>
                        </TableCell>
                        <TableCell>{p.courseName}</TableCell>
                        <TableCell>
                          <Badge variant={p.isOptional ? "outline" : "default"}>
                            {p.isOptional ? "Optional" : "Required"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
