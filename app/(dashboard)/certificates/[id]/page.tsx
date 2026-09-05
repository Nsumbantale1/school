export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  canApproveCertificateAsChiefInstructor,
  canApproveCertificateAsCommandant,
  canCreateCertificateRequest,
  canPrintApprovedCertificates,
  canViewCertificateRequests,
} from "@/lib/auth/permissions";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CERT_REQUEST_STATUS_LABEL,
  getCertificateRequestDetail,
  listEligibleEnrollmentsForIntake,
} from "@/lib/utils/certificate-requests";
import { formatIntakeLabel } from "@/lib/utils/intake-label";
import { ApprovalActions } from "../_components/approval-actions";
import { BatchPrintButton } from "../_components/batch-print-button";
import { ReviseRequestForm } from "../_components/revise-request-form";

export default async function CertificateRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !canViewCertificateRequests(user.role)) {
    redirect("/dashboard?error=unauthorized");
  }

  const { id } = await params;
  const requestId = parseInt(id, 10);
  if (!Number.isFinite(requestId)) notFound();

  const detail = await getCertificateRequestDetail(requestId);
  if (!detail) notFound();

  const { request, items } = detail;
  const canApproveCI =
    request.status === "pending_chief_instructor" &&
    canApproveCertificateAsChiefInstructor(user.role);
  const canApproveCmdt =
    request.status === "pending_commandant" &&
    canApproveCertificateAsCommandant(user.role);
  const canPrint =
    canPrintApprovedCertificates(user.role) &&
    (request.status === "approved" ||
      request.status === "partially_issued" ||
      request.status === "issued");
  const canRevise =
    canCreateCertificateRequest(user.role) &&
    (request.status === "rejected" || request.status === "draft");

  let eligibleForRevise: Array<{
    enrollmentId: number;
    armyNumber: string;
    fullName: string;
    rank: string;
    grade: string | null;
  }> = [];
  if (canRevise) {
    const eligible = await listEligibleEnrollmentsForIntake(request.intakeId);
    eligibleForRevise = eligible.map((e) => ({
      enrollmentId: e.enrollmentId,
      armyNumber: e.armyNumber,
      fullName: e.fullName,
      rank: e.rankAtEnrollment,
      grade: e.grade,
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.requestNumber}
        description={`${request.courseCode} · ${formatIntakeLabel({ intakeNumber: request.intakeNumber })}`}
      >
        <BackButton fallbackHref="/certificates" />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Certificates requested</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {request.certificateCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-base">
              <Badge>
                {CERT_REQUEST_STATUS_LABEL[request.status] ?? request.status}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approvals</CardDescription>
            <CardTitle className="text-sm font-normal leading-relaxed">
              CI:{" "}
              {request.chiefInstructorApprovedAt
                ? request.chiefInstructorApprovedAt.toLocaleString("en-GB")
                : "—"}
              <br />
              Commandant:{" "}
              {request.commandantApprovedAt
                ? request.commandantApprovedAt.toLocaleString("en-GB")
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {request.rejectionReason && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Rejected</CardTitle>
            <CardDescription>
              Stage: {request.rejectedStage?.replace(/_/g, " ") ?? "—"}
              {request.rejectedAt
                ? ` · ${request.rejectedAt.toLocaleString("en-GB")}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">{request.rejectionReason}</CardContent>
        </Card>
      )}

      {(canApproveCI || canApproveCmdt) && (
        <ApprovalActions
          requestId={request.id}
          certificateCount={request.certificateCount}
          canApprove
        />
      )}

      {canPrint && (
        <BatchPrintButton
          requestId={request.id}
          items={items.map((i) => ({
            enrollmentId: i.enrollmentId,
            studentArmyNumber: i.studentArmyNumber,
            fullName: i.fullName,
            status: i.status,
          }))}
        />
      )}

      {canRevise && (
        <ReviseRequestForm
          requestId={request.id}
          eligible={eligibleForRevise}
          initiallySelected={items.map((i) => i.enrollmentId)}
          notes={request.notes}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Students on this request ({items.length})
          </CardTitle>
          <CardDescription>
            Names included in the approval count above
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3">Army No</th>
                  <th className="pb-2 pr-3">Rank / Name</th>
                  <th className="pb-2 pr-3">Grade</th>
                  <th className="pb-2">Item status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="py-2 pr-3 font-mono text-xs">
                      {i.studentArmyNumber}
                    </td>
                    <td className="py-2 pr-3">
                      {i.rank} {i.fullName}
                    </td>
                    <td className="py-2 pr-3">{i.grade ?? "—"}</td>
                    <td className="py-2 capitalize">{i.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
