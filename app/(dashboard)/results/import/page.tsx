export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { courseIntakes, courses } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { requireAuth, canManageResults } from "@/lib/auth/guards";
import { ImportResultsForm } from "./_components/import-form";

interface PageProps {
  searchParams: Promise<{ intakeId?: string }>;
}

export default async function ImportResultsPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  if (!canManageResults(user.role)) {
    redirect("/results");
  }

  // Official SOFA workbook import is admin-only (see importOfficialSofaWorkbook).
  // Instructors may still use the CSV/manual import path for their course.

  const params = await searchParams;

  let intakeRows = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      isActive: courseIntakes.isActive,
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .orderBy(desc(courseIntakes.year), courseIntakes.intakeNumber);

  if (user.role === "instructor" && user.assignedCourseId) {
    intakeRows = intakeRows.filter((i) => i.courseId === user.assignedCourseId);
  }

  const intakes = intakeRows.map((i) => ({
    intakeId: i.intakeId,
    label: `${i.courseCode} — ${i.intakeNumber} (${i.year})${
      i.isActive ? "" : " [inactive]"
    } · ${i.courseName}`,
  }));

  const defaultIntakeId = params.intakeId
    ? parseInt(params.intakeId, 10)
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Results"
        description="Upload official SOFA course Excel files, or a simple marks template"
      >
        <BackButton fallbackHref="/results" label="Back to Results" />
      </PageHeader>

      <ImportResultsForm
        intakes={intakes}
        canImportOfficial={user.role === "admin"}
        defaultIntakeId={
          defaultIntakeId && !Number.isNaN(defaultIntakeId)
            ? defaultIntakeId
            : undefined
        }
      />
    </div>
  );
}
