"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CertificateRequestRow = {
  id: number;
  requestNumber: string;
  status: string;
  statusLabel: string;
  certificateCount: number;
  submittedLabel: string;
  courseCode: string;
  courseName: string;
  intakeLabel: string;
};

type View = "open" | "printed" | "all";

const VIEWS: { value: View; label: string }[] = [
  { value: "open", label: "Not yet printed" },
  { value: "printed", label: "Printed" },
  { value: "all", label: "All" },
];

const PRINTED = new Set(["issued", "cancelled"]);

/** Ready-to-print first, then requests still moving through approval. */
const OPEN_ORDER: Record<string, number> = {
  approved: 0,
  partially_issued: 1,
  pending_commandant: 2,
  pending_chief_instructor: 3,
  rejected: 4,
  draft: 5,
};

function statusVariant(
  status: string
): "success" | "secondary" | "destructive" | "outline" {
  if (status === "approved" || status === "issued") return "success";
  if (status === "rejected" || status === "cancelled") return "destructive";
  if (status.startsWith("pending")) return "secondary";
  return "outline";
}

function inView(row: CertificateRequestRow, view: View) {
  if (view === "all") return true;
  return view === "printed" ? PRINTED.has(row.status) : !PRINTED.has(row.status);
}

/** "17/25-26", "17-25" and "1725" should all find the same intake. */
function compact(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matches(row: CertificateRequestRow, query: string) {
  const tokens = query.split(/\s+/).map(compact).filter(Boolean);
  if (tokens.length === 0) return true;
  const fields = [
    row.requestNumber,
    row.courseCode,
    row.courseName,
    row.intakeLabel,
    row.statusLabel,
  ].map(compact);
  return tokens.every((token) => fields.some((field) => field.includes(token)));
}

export function CertificateRequestsBrowser({
  rows,
}: {
  rows: CertificateRequestRow[];
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("open");

  const searched = useMemo(
    () => rows.filter((r) => matches(r, query)),
    [query, rows]
  );

  const counts = useMemo(
    () => ({
      open: searched.filter((r) => inView(r, "open")).length,
      printed: searched.filter((r) => inView(r, "printed")).length,
      all: searched.length,
    }),
    [searched]
  );

  const filtered = useMemo(() => {
    const list = searched.filter((r) => inView(r, view));
    if (view !== "open") return list;
    return [...list].sort(
      (a, b) => (OPEN_ORDER[a.status] ?? 9) - (OPEN_ORDER[b.status] ?? 9)
    );
  }, [searched, view]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by course or intake…"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border p-1">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setView(v.value)}
              className={cn(
                "rounded-md px-3 py-1 text-sm transition-colors",
                view === v.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {v.label} ({counts[v.value]})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          {view === "open" && counts.printed > 0 ? (
            <>
              Everything matching this search is already printed.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setView("printed")}
              >
                Show printed ({counts.printed})
              </button>
            </>
          ) : (
            "No requests match that course or intake."
          )}
        </div>
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
              {filtered.map((r) => (
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
                    <p>{r.courseCode} · {r.intakeLabel}</p>
                    <p className="text-xs text-muted-foreground">{r.courseName}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums font-semibold">
                    {r.certificateCount}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(r.status)}>{r.statusLabel}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.submittedLabel}
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
