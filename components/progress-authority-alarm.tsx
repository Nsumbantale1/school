import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function ProgressAuthorityAlarm({
  count,
}: {
  count: number;
}) {
  if (count < 1) return null;
  return (
    <Link
      href="/weekly/authority"
      className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm transition hover:brightness-95"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <span>
        <span className="block text-sm font-semibold">
          {count} weekly mark correction{count === 1 ? "" : "s"} need your authority
        </span>
        <span className="mt-0.5 block text-sm">
          A coordinator wants to change marks that are already saved.
        </span>
      </span>
    </Link>
  );
}
