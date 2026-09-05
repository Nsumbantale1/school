export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  certificateRequests,
  courses,
  courseIntakes,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import {
  canApproveCertificateAsChiefInstructor,
  canApproveCertificateAsCommandant,
  canViewCertificateRequests,
} from "@/lib/auth/permissions";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatIntakeLabel } from "@/lib/utils/intake-label";

export default async function CertificateApprovalsPage() {
  const user = await getSessionUser();
  if (!user || !canViewCertificateRequests(user.role)) {
    redirect("/dashboard?error=unauthorized");
  }

  const isCI = canApproveCertificateAsChiefInstructor(user.role);
  const isCmdt = canApproveCertificateAsCommandant(user.role);

  if (!isCI && !isCmdt && user.role !== "admin") {
    redirect("/certificates");
  }

  const targetStatus = isCI
    ? "pending_chief_instructor"
    : isCmdt
      ? "pending_commandant"
      : null;

  const rows = await db
    .select({
      id: certificateRequests.id,
      requestNumber: certificateRequests.requestNumber,
      status: certificateRequests.status,
      certificateCount: certificateRequests.certificateCount,
      submittedAt: certificateRequests.submittedAt,
      courseCode: courses.courseCode,
      intakeNumber: courseIntakes.intakeNumber,
      notes: certificateRequests.notes,
    })
    .from(certificateRequests)
    .innerJoin(courses, eq(certificateRequests.courseId, courses.courseId))
    .innerJoin(
      courseIntakes,
      eq(certificateRequests.intakeId, courseIntakes.intakeId)
    )
    .orderBy(desc(certificateRequests.submittedAt))
    .limit(50);

  const queue = targetStatus
    ? rows.filter((r) => r.status === targetStatus)
    : rows.filter(
        (r) =>
          r.status === "pending_chief_instructor" ||
          r.status === "pending_commandant"
      );

  const title = isCI
    ? "Chief Instructor — approval queue"
    : isCmdt
      ? "Commandant — approval queue"
      : "Pending approvals";

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="Approve or reject certificate print requests. Count shown is number of certificates."
      >
        <BackButton fallbackHref="/certificates" />
      </PageHeader>

      {queue.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No requests waiting for your approval.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {queue.map((r) => (
            <Link
              key={r.id}
              href={`/certificates/${r.id}`}
              className="block rounded-lg border p-4 transition hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.requestNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.courseCode} · {formatIntakeLabel({ intakeNumber: r.intakeNumber })}
                  </p>
                  {r.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.notes}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="tabular-nums">
                  {r.certificateCount} certificate
                  {r.certificateCount === 1 ? "" : "s"}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
