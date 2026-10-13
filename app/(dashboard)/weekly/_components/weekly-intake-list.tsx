"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type WeeklyIntakeCard = {
  intakeId: number;
  title: string;
  courseCode: string;
  courseName: string;
  intakeLabel: string;
  intakeNumber: string;
  week: number;
  totalWeeks: number;
  month: number;
  totalMonths: number;
  phase: "current" | "upcoming";
  period: string;
};

export function WeeklyIntakeList({ items }: { items: WeeklyIntakeCard[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = !q
      ? items
      : items.filter((item) =>
          `${item.title} ${item.courseCode} ${item.courseName} ${item.intakeLabel} ${item.intakeNumber}`
            .toLowerCase()
            .includes(q)
        );
    return [...matched].sort((a, b) => {
      if (a.phase !== b.phase) return a.phase === "current" ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }, [items, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by course or intake…"
            className="h-9 pl-8"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {filtered.length} intake{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
          No running or upcoming intake matches that search.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const progress = Math.round((item.week / item.totalWeeks) * 100);
            return (
              <Link
                key={item.intakeId}
                href={`/weekly/${item.intakeId}`}
                className="group rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.courseCode} · Intake {item.intakeLabel}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      item.phase === "current"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.phase === "current" ? "In progress" : "Upcoming"}
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  Week{" "}
                  <span className="font-semibold tabular-nums">{item.week}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    of {item.totalWeeks}
                  </span>
                  {item.totalMonths > 0 && (
                    <>
                      <span className="text-muted-foreground"> · </span>
                      Month{" "}
                      <span className="font-semibold tabular-nums">{item.month}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        of {item.totalMonths}
                      </span>
                    </>
                  )}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${item.phase === "upcoming" ? 0 : progress}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.period}</span>
                  <span className="inline-flex items-center gap-1">
                    Open chart
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
