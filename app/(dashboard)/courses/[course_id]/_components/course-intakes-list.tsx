"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Users,
  CalendarDays,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatIntakeLabel } from "@/lib/utils/intake-label";

export interface IntakeListItem {
  intakeId: number;
  intakeNumber: string;
  year: number;
  commanderName: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  studentCount: number;
}

function formatPeriod(start: string, end: string | null): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  };
  if (!end) return `${fmt(start)} → …`;
  return `${fmt(start)} → ${fmt(end)}`;
}

export function CourseIntakesList({
  intakes,
}: {
  courseId: number;
  intakes: IntakeListItem[];
}) {
  if (intakes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cfc8b8] bg-[#fbf9f4]/70 px-6 py-14 text-center dark:border-border dark:bg-muted/20">
        <p className="text-sm text-muted-foreground">
          No intakes in this course folder yet.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {intakes.map((intake, index) => {
        const label = formatIntakeLabel({
          intakeNumber: intake.intakeNumber,
          startDate: intake.startDate,
          endDate: intake.endDate,
          year: intake.year,
        });

        return (
          <li key={intake.intakeId} className="min-w-0">
            <Link
              href={`/intakes/${intake.intakeId}`}
              prefetch
              className={cn(
                "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#ddd6c6]",
                "bg-[linear-gradient(165deg,rgba(255,255,255,0.55),transparent_42%),linear-gradient(180deg,#fbf8f1_0%,#f0ebe0_100%)]",
                "shadow-[0_8px_22px_-14px_rgba(0,0,0,0.35)] transition-all duration-300 ease-out",
                "hover:-translate-y-1.5 hover:scale-[1.015] hover:border-[#1a5c2e]/35",
                "hover:shadow-[0_18px_36px_-16px_rgba(26,92,46,0.45)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                "dark:border-border dark:bg-[linear-gradient(180deg,#1c241c,#141a14)]"
              )}
            >
              {/* Top accent bar */}
              <div className="h-1 w-full bg-gradient-to-r from-[#1a5c2e] via-[#2d8a45] to-[#c9a227] opacity-90 transition-opacity group-hover:opacity-100" />

              {/* Shine */}
              <div
                className="pointer-events-none absolute inset-0 translate-x-[-130%] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition-all duration-500 group-hover:translate-x-[130%] group-hover:opacity-100"
                aria-hidden
              />

              <div className="relative flex flex-1 flex-col p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6b7a6b] dark:text-muted-foreground">
                      Intake {String(index + 1).padStart(2, "0")}
                    </p>
                    <p
                      className="mt-1 truncate text-[1.55rem] font-semibold leading-none tracking-wide text-[#142016] transition-colors group-hover:text-[#0d3d1c] dark:text-[#e8f0e8]"
                      style={{
                        fontFamily:
                          "var(--font-course-display), ui-sans-serif, system-ui",
                      }}
                    >
                      {label}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        intake.isActive
                          ? "bg-[#1a5c2e] text-white"
                          : "bg-black/8 text-muted-foreground dark:bg-white/10"
                      )}
                    >
                      {intake.isActive ? "Active" : "Closed"}
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a5c2e]/0 text-[#1a5c2e] opacity-0 transition-all duration-300 group-hover:bg-[#1a5c2e]/12 group-hover:opacity-100 dark:text-[#7dcea0]">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-xs text-[#5c6b5c] dark:text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 shrink-0 text-[#1a5c2e]/70 dark:text-[#7dcea0]" />
                    <span className="font-medium text-[#142016] dark:text-foreground">
                      {intake.studentCount}
                    </span>
                    student{intake.studentCount === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#1a5c2e]/70 dark:text-[#7dcea0]" />
                    {formatPeriod(intake.startDate, intake.endDate)}
                  </span>
                  {intake.commanderName && (
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-[#1a5c2e]/70 dark:text-[#7dcea0]" />
                      <span className="truncate">{intake.commanderName}</span>
                    </span>
                  )}
                </div>

                <p className="mt-auto pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1a5c2e] opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:text-[#7dcea0]">
                  Open intake
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
