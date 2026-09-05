export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseIntakes, courses } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { canCreateCertificateRequest } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { NewCertificateRequestForm } from "../_components/new-request-form";
import { formatIntakeLabel } from "@/lib/utils/intake-label";
import { getCourseDisplayMeta } from "@/lib/utils/course-catalog";

export default async function NewCertificateRequestPage() {
  const user = await getSessionUser();
  if (!user || !canCreateCertificateRequest(user.role)) {
    redirect("/dashboard?error=unauthorized");
  }

  const intakes = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(courses.isActive, true))
    .orderBy(desc(courseIntakes.year), courses.courseCode);

  const options = intakes.map((i) => {
    const meta = getCourseDisplayMeta(i.courseCode, i.courseName);
    return {
      intakeId: i.intakeId,
      label: `${meta.label} · ${formatIntakeLabel({ intakeNumber: i.intakeNumber, year: i.year })} (${i.year})`,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New certificate print request"
        description="Select students — Chief Instructor then Commandant must approve before printing"
      >
        <BackButton fallbackHref="/certificates" />
      </PageHeader>

      <NewCertificateRequestForm intakes={options} />
    </div>
  );
}
