export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import {
  students,
  enrollments,
  courseIntakes,
  courses,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StudentsTable } from "./_components/students-table";
import { PrintButton } from "@/components/print-button";
import { Plus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canManageStudents } from "@/lib/auth/guards";

export default async function StudentsPage() {
  const user = await getSessionUser();
  const data = await db
    .select()
    .from(students)
    .where(eq(students.isActive, true))
    .orderBy(students.fullName);

  const enrollmentRows = await db
    .select({
      studentArmyNumber: enrollments.studentArmyNumber,
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(enrollments)
    .innerJoin(
      courseIntakes,
      eq(enrollments.intakeId, courseIntakes.intakeId),
    )
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId));

  const enrollmentsByStudent = new Map<
    string,
    { courseId: number; intakeId: number }[]
  >();
  for (const row of enrollmentRows) {
    const list = enrollmentsByStudent.get(row.studentArmyNumber) ?? [];
    list.push({ courseId: row.courseId, intakeId: row.intakeId });
    enrollmentsByStudent.set(row.studentArmyNumber, list);
  }

  const courseMap = new Map<
    number,
    { courseId: number; courseCode: string; courseName: string }
  >();
  const intakeMap = new Map<
    number,
    { intakeId: number; intakeNumber: string; courseId: number }
  >();
  for (const r of enrollmentRows) {
    if (!courseMap.has(r.courseId)) {
      courseMap.set(r.courseId, {
        courseId: r.courseId,
        courseCode: r.courseCode,
        courseName: r.courseName,
      });
    }
    if (!intakeMap.has(r.intakeId)) {
      intakeMap.set(r.intakeId, {
        intakeId: r.intakeId,
        intakeNumber: r.intakeNumber,
        courseId: r.courseId,
      });
    }
  }

  const tableData = data.map((s) => ({
    ...s,
    enrollments: enrollmentsByStudent.get(s.armyNumber) ?? [],
  }));
  const courseList = Array.from(courseMap.values()).sort((a, b) =>
    a.courseName.localeCompare(b.courseName),
  );
  const intakeList = Array.from(intakeMap.values()).sort((a, b) =>
    a.intakeNumber.localeCompare(b.intakeNumber),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Students" description="Manage student records">
        <PrintButton title="Student List — School of Field Artillery" />
        {user && canManageStudents(user.role) && (
          <Button asChild>
            <Link href="/students/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Link>
          </Button>
        )}
      </PageHeader>
      <StudentsTable
        data={tableData}
        courses={courseList}
        intakes={intakeList}
      />
    </div>
  );
}
