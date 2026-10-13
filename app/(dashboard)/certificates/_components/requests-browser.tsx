"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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

function statusVariant(
  status: string
): "success" | "secondary" | "destructive" | "outline" {
  if (status === "approved" || status === "issued") return "success";
  if (status === "rejected" || status === "cancelled") return "destructive";
  if (status.startsWith("pending")) return "secondary";
  return "outline";
}

export function CertificateRequestsBrowser({
  rows,
}: {
  rows: CertificateRequestRow[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.requestNumber} ${r.courseCode} ${r.courseName} ${r.intakeLabel} ${r.statusLabel}`
        .toLowerCase()
        .includes(q)
    );
  }, [query, rows]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by course or intake…"
          className="h-9 pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No requests match that course or intake.
        </p>
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
