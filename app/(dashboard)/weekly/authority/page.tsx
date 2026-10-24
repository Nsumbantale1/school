export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { listPendingProgressAuthorities } from "@/lib/utils/progress-authority";
import { AuthorityDecision } from "../_components/authority-decision";

export default async function WeeklyAuthorityPage() {
  const user = await requireAuth();
  if (user.role !== "chief_instructor" && user.role !== "admin") {
    redirect("/weekly");
  }
  const canDecide = user.role === "chief_instructor";
  const rows = await listPendingProgressAuthorities();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly mark authority"
        description="A coordinator needs the Chief Instructor before changing marks that are already saved."
      >
        <BackButton fallbackHref="/weekly" />
      </PageHeader>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requests are waiting.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border px-4 py-3">
              <p className="text-sm font-medium">
                {row.courseCode} · {row.intakeNumber}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {row.requestedByName}: {row.reason}
              </p>
              {canDecide && <AuthorityDecision id={row.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
