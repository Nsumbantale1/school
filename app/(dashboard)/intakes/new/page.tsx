import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { IntakeForm } from "../_components/intake-form";
import { requireRole } from "@/lib/auth/guards";

interface PageProps {
  searchParams: Promise<{ courseId?: string }>;
}

export default async function NewIntakePage({ searchParams }: PageProps) {
  await requireRole(["admin"]);
  const params = await searchParams;

  const activeCourses = await db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(courses)
    .where(eq(courses.isActive, true))
    .orderBy(courses.courseCode);

  const defaultCourseId = params.courseId ? parseInt(params.courseId) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Intake"
        description="Create a new course intake"
      />
      <IntakeForm courses={activeCourses} defaultCourseId={defaultCourseId} />
    </div>
  );
}
