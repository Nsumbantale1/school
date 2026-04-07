export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { courseIntakes, courses, enrollments } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { IntakesTable } from "./_components/intakes-table";
import { PrintButton } from "@/components/print-button";
import { Plus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canManageIntakes } from "@/lib/auth/guards";

export default async function IntakesPage() {
  const user = await getSessionUser();

  // Get intakes with course info and enrollment count
  const data = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      commanderName: courseIntakes.commanderName,
      coordinatorName: courseIntakes.coordinatorName,
      startDate: courseIntakes.startDate,
      endDate: courseIntakes.endDate,
      enrollmentCount: sql<number>`(
        SELECT COUNT(*) FROM enrollments
        WHERE enrollments.intake_id = course_intakes.intake_id
      )`.as("enrollment_count"),
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .orderBy(desc(courseIntakes.year), desc(courseIntakes.startDate));

  return (
    <div className="space-y-6">
      <PageHeader title="Intakes" description="Manage course intakes">
        <PrintButton title="Intakes List — School of Field Artillery" />
        {user && canManageIntakes(user.role) && (
          <Button asChild>
            <Link href="/intakes/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Intake
            </Link>
          </Button>
        )}
      </PageHeader>
      <IntakesTable data={data} />
    </div>
  );
}
