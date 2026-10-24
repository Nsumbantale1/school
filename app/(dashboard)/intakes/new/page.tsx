import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { IntakeForm } from "../_components/intake-form";
import { requireAuth } from "@/lib/auth/guards";

interface PageProps {
  searchParams: Promise<{ courseId?: string }>;
}

export default async function NewIntakePage({ searchParams }: PageProps) {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "instructor") {
    redirect("/dashboard?error=unauthorized");
  }
  if (user.role === "instructor" && !user.assignedCourseId) {
    redirect("/dashboard?error=unauthorized");
  }
  const params = await searchParams;

  const activeCourses = await db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(courses)
    .where(
      user.role === "instructor"
        ? and(eq(courses.isActive, true), eq(courses.courseId, user.assignedCourseId!))
        : eq(courses.isActive, true)
    )
    .orderBy(courses.courseCode);

  const requested = params.courseId ? parseInt(params.courseId, 10) : undefined;
  const defaultCourseId =
    user.role === "instructor" ? user.assignedCourseId! : requested;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Intake"
        description="Create a new course intake"
      >
        <BackButton
          fallbackHref={
            defaultCourseId ? `/courses/${defaultCourseId}` : "/intakes"
          }
        />
      </PageHeader>
      <IntakeForm courses={activeCourses} defaultCourseId={defaultCourseId} />
    </div>
  );
}
