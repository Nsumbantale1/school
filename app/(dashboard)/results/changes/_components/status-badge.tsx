import type { ResultChangeStatus } from "@/lib/utils/result-changes";

const TONE: Record<ResultChangeStatus, string> = {
  pending_chief_instructor: "border-amber-300 bg-amber-50 text-amber-900",
  pending_commandant: "border-sky-300 bg-sky-50 text-sky-900",
  applied: "border-emerald-300 bg-emerald-50 text-emerald-900",
  rejected: "border-rose-300 bg-rose-50 text-rose-900",
  cancelled: "border-muted bg-muted text-muted-foreground",
};

export function ResultChangeStatusBadge({
  status,
  label,
}: {
  status: ResultChangeStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[status] ?? TONE.cancelled}`}
    >
      {label ?? status}
    </span>
  );
}
