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
  canCreateCertificateRequest,
  canViewCertificateRequests,
} from "@/lib/auth/permissions";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, ClipboardCheck } from "lucide-react";
import { CERT_REQUEST_STATUS_LABEL } from "@/lib/utils/certificate-requests";
import { formatIntakeLabel } from "@/lib/utils/intake-label";

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved" || status === "issued") return "default";
  if (status === "rejected" || status === "cancelled") return "destructive";
  if (status.startsWith("pending")) return "secondary";
  return "outline";
}

export default async function CertificatesIndexPage() {
  const user = await getSessionUser();
  if (!user || !canViewCertificateRequests(user.role)) {
    redirect("/dashboard?error=unauthorized");
  }

  const isOfficial =
    user.role === "chief_instructor" || user.role === "commandant";

  const rows = await db
    .select({
      id: certificateRequests.id,
      requestNumber: certificateRequests.requestNumber,
      status: certificateRequests.status,
      certificateCount: certificateRequests.certificateCount,
      submittedAt: certificateRequests.submittedAt,
      createdAt: certificateRequests.createdAt,
      courseCode: courses.courseCode,
      intakeNumber: courseIntakes.intakeNumber,
    })
    .from(certificateRequests)
    .innerJoin(courses, eq(certificateRequests.courseId, courses.courseId))
    .innerJoin(
      courseIntakes,
      eq(certificateRequests.intakeId, courseIntakes.intakeId)
    )
    .orderBy(desc(certificateRequests.createdAt))
    .limit(100);

  const queue =
    user.role === "chief_instructor"
      ? rows.filter((r) => r.status === "pending_chief_instructor")
      : user.role === "commandant"
        ? rows.filter((r) => r.status === "pending_commandant")
        : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates"
        description="Dual approval: Chief Instructor → Commandant → print"
      >
        <div className="flex flex-wrap gap-2">
          <BackButton fallbackHref="/dashboard" />
          {isOfficial && (
            <Button asChild variant="secondary">
              <Link href="/certificates/approvals">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Approval queue ({queue.length})
              </Link>
            </Button>
          )}
          {canCreateCertificateRequest(user.role) && (
            <Button asChild>
              <Link href="/certificates/new">
                <Plus className="mr-2 h-4 w-4" />
                New print request
              </Link>
            </Button>
          )}
        </div>
      </PageHeader>

      {isOfficial && queue.length > 0 && (
        <Card className="border-[#1a5c2e]/30 bg-[#1a5c2e]/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm">
              You have{" "}
              <strong>
                {queue.length} request{queue.length === 1 ? "" : "s"}
              </strong>{" "}
              waiting for your approval (
              {queue.reduce((s, r) => s + r.certificateCount, 0)} certificates
              total).
            </p>
            <Button asChild size="sm">
              <Link href="/certificates/approvals">Review now</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No certificate print requests yet.
            {canCreateCertificateRequest(user.role) && (
              <>
                {" "}
                <Link href="/certificates/new" className="underline">
                  Create the first request
                </Link>
                .
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Request</th>
                <th className="px-3 py-2">Course / Intake</th>
                <th className="px-3 py-2">Certificates</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link
                      href={`/certificates/${r.id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {r.requestNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {r.courseCode} · {formatIntakeLabel({ intakeNumber: r.intakeNumber })}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-semibold">
                    {r.certificateCount}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(r.status)}>
                      {CERT_REQUEST_STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {(r.submittedAt ?? r.createdAt)?.toLocaleDateString?.(
                      "en-GB"
                    ) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
