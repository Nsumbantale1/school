export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { canViewAllRecords } from "@/lib/auth/permissions";
import {
  canDecideResultChange,
  getResultChangeRequest,
  OPEN_RESULT_CHANGE,
  RESULT_CHANGE_STATUS_LABEL,
  type ResultChangeStatus,
} from "@/lib/utils/result-changes";
import { ResultChangeStatusBadge } from "../_components/status-badge";
import { ResultChangeDecision } from "../_components/decision";

const fmt = (v: string | null | undefined, digits = 2) =>
  v == null || v === "" ? "—" : Number(v).toFixed(digits);

const when = (d: Date | null) =>
  d
    ? d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

export default async function ResultChangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["admin", "instructor", "chief_instructor", "commandant"]);
  const { id } = await params;
  const requestId = parseInt(id, 10);
  if (!Number.isFinite(requestId)) notFound();

  const data = await getResultChangeRequest(requestId);
  if (!data) notFound();
  const { request, intake, items } = data;
  if (!canViewAllRecords(user.role) && request.requestedBy !== user.userId) notFound();

  const status = request.status as ResultChangeStatus;
  const isOpen = OPEN_RESULT_CHANGE.includes(status);
  const canDecide = canDecideResultChange(user.role, status);
  const canCancel = isOpen && (user.role === "admin" || request.requestedBy === user.userId);

  const timeline = [
    { label: "Requested", by: data.requestedByName, at: when(request.createdAt) },
    {
      label: "Chief Instructor approved",
      by: data.chiefInstructorName,
      at: when(request.chiefInstructorApprovedAt),
    },
    {
      label: "Commandant approved and applied",
      by: data.commandantName,
      at: when(request.commandantApprovedAt),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Result change ${request.requestNumber}`}
        description={
          intake ? `${intake.courseCode} — ${intake.courseName} · ${intake.intakeNumber}` : undefined
        }
      >
        <ResultChangeStatusBadge status={status} label={RESULT_CHANGE_STATUS_LABEL[status]} />
        <Button variant="outline" asChild>
          <Link href="/results/changes">All requests</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Reason</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{request.reason}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Approval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {timeline.map((step) => (
              <div key={step.label} className="flex justify-between gap-3">
                <span className={step.at ? "" : "text-muted-foreground"}>{step.label}</span>
                <span className="text-right text-xs text-muted-foreground">
                  {step.at ? `${step.by ?? "—"} · ${step.at}` : "Not yet"}
                </span>
              </div>
            ))}
            {status === "rejected" && (
              <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                Rejected by {data.rejectedByName ?? "—"} on {when(request.rejectedAt)}:{" "}
                {request.rejectionReason}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(canDecide || canCancel) && (
        <ResultChangeDecision
          requestId={request.id}
          canDecide={canDecide}
          canCancel={canCancel}
          approveLabel={
            user.role === "commandant" ? "Approve and apply the change" : "Approve and send to Commandant"
          }
        />
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>What changes</TableHead>
              <TableHead>Now</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Item status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(({ item, armyNumber, fullName, rank }) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="tracking-wide">
                    {rank} {fullName}
                  </span>
                  <p className="font-mono text-xs text-muted-foreground">{armyNumber}</p>
                </TableCell>
                <TableCell className="text-sm">
                  {item.kind === "enrollment_marks"
                    ? "Average, grade and position"
                    : item.kind === "delete_result"
                      ? `Remove ${item.subjectName}`
                      : item.subjectName}
                </TableCell>
                <TableCell className="text-sm">
                  {item.kind === "enrollment_marks" ? (
                    <>
                      {fmt(item.oldAverage)}% · {item.oldGrade ?? "—"} · pos {item.oldPosition ?? "—"}
                    </>
                  ) : (
                    <>
                      {fmt(item.oldMarks, 1)} / {fmt(item.oldMaxMarks, 0)} ({item.oldGrade ?? "—"})
                    </>
                  )}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {item.kind === "enrollment_marks" ? (
                    <>
                      {fmt(item.newAverage)}% · {item.newGrade ?? "—"} · pos {item.newPosition ?? "—"}
                    </>
                  ) : item.kind === "delete_result" ? (
                    <span className="text-rose-700">Removed</span>
                  ) : (
                    <>
                      {fmt(item.newMarks, 1)} / {fmt(item.newMaxMarks, 0)} ({item.newGrade ?? "—"})
                    </>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {item.status === "applied"
                    ? "Applied"
                    : item.status === "skipped"
                      ? `Skipped — ${item.note ?? ""}`
                      : isOpen
                        ? "Waiting"
                        : "Not applied"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
