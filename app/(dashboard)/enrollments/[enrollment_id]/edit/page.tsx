export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { enrollments, students, courses, courseIntakes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { requireRole } from "@/lib/auth/guards";
import { EnrollmentEditForm } from "../../_components/enrollment-edit-form";

export default async function EditEnrollmentPage({
  params,
}: {
  params: Promise<{ enrollment_id: string }>;
}) {
  await requireRole(["admin"]);
  const { enrollment_id } = await params;
  const enrollmentId = parseInt(enrollment_id, 10);
  if (!Number.isFinite(enrollmentId)) notFound();

  const rows = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      fullName: students.fullName,
      courseCode: courses.courseCode,
      intakeNumber: courseIntakes.intakeNumber,
      rankAtEnrollment: enrollments.rankAtEnrollment,
      unitAtEnrollment: enrollments.unitAtEnrollment,
      status: enrollments.status,
      ceasedAt: enrollments.ceasedAt,
      averageMarks: enrollments.averageMarks,
      grade: enrollments.grade,
      position: enrollments.position,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(enrollments.enrollmentId, enrollmentId))
    .limit(1);

  const enrollment = rows[0];
  if (!enrollment) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Enrollment"
        description={`${enrollment.rankAtEnrollment} ${enrollment.fullName} — ${enrollment.courseCode} (${enrollment.intakeNumber})`}
      >
        <BackButton fallbackHref={`/enrollments/${enrollmentId}`} />
      </PageHeader>
      <EnrollmentEditForm
        initialData={{
          enrollmentId: enrollment.enrollmentId,
          rankAtEnrollment: enrollment.rankAtEnrollment,
          unitAtEnrollment: enrollment.unitAtEnrollment,
          status: enrollment.status ?? "enrolled",
          ceasedAt: enrollment.ceasedAt
            ? enrollment.ceasedAt.toISOString()
            : null,
          averageMarks: enrollment.averageMarks,
          grade: enrollment.grade,
          position: enrollment.position,
        }}
      />
    </div>
  );
}
