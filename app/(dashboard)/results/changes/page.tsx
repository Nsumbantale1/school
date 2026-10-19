export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import {
  listResultChangeRequests,
  OPEN_RESULT_CHANGE,
  RESULT_CHANGE_STATUS_LABEL,
  type ResultChangeStatus,
} from "@/lib/utils/result-changes";
import { ResultChangeStatusBadge } from "./_components/status-badge";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Results table",
  import: "File import",
  enrollment: "Enrollment edit",
};

type Filter = "mine" | "open" | "all";

export default async function ResultChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const user = await requireRole(["admin", "instructor", "chief_instructor", "commandant"]);
  const { show } = await searchParams;

  const myStage: ResultChangeStatus | null =
    user.role === "chief_instructor"
      ? "pending_chief_instructor"
      : user.role === "commandant"
        ? "pending_commandant"
        : null;
  const filter: Filter =
    show === "all" || show === "open" || show === "mine"
      ? show
      : myStage
        ? "mine"
        : "open";

  const all = await listResultChangeRequests(user);
  const rows = all.filter((r) => {
    if (filter === "all") return true;
    if (filter === "mine" && myStage) return r.status === myStage;
    return OPEN_RESULT_CHANGE.includes(r.status as ResultChangeStatus);
  });

  const tabs: Array<{ key: Filter; label: string }> = [
    ...(myStage ? [{ key: "mine" as const, label: "Waiting for me" }] : []),
    { key: "open", label: "Open" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Result Changes"
        description="Recorded marks change only after the Chief Instructor and then the Commandant approve."
      >
        <Button variant="outline" asChild>
          <Link href="/results">Back to results</Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            size="sm"
            variant={filter === tab.key ? "default" : "outline"}
            asChild
          >
            <Link href={`/results/changes?show=${tab.key}`}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Course / intake</TableHead>
              <TableHead>Requested by</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {filter === "mine"
                    ? "Nothing is waiting for your approval."
                    : "No result change requests."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/results/changes/${r.id}`}
                      className="font-mono text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {r.requestNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{r.courseCode}</span>
                    <p className="text-xs text-muted-foreground">{r.intakeNumber}</p>
                  </TableCell>
                  <TableCell>{r.requestedByName}</TableCell>
                  <TableCell className="text-xs">{SOURCE_LABEL[r.source] ?? r.source}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-xs" title={r.reason}>
                    {r.reason}
                  </TableCell>
                  <TableCell>
                    <ResultChangeStatusBadge
                      status={r.status as ResultChangeStatus}
                      label={RESULT_CHANGE_STATUS_LABEL[r.status as ResultChangeStatus]}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {r.createdAt.toLocaleDateString("en-GB")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
