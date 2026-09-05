"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderOpen, Search, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  sortCoursesByCatalog,
  type CourseFamily,
} from "@/lib/utils/course-catalog";

export interface CourseFolderRow {
  courseId: number;
  courseCode: string;
  courseName: string;
  durationWeeks: number;
  passingMark: number;
  intakeCount: number;
}

const FAMILY_ACCENT: Record<CourseFamily, string> = {
  officers: "from-[#1a5c2e] to-[#2d8a45]",
  observation: "from-[#0f4c5c] to-[#1a7a8c]",
  artilleryman: "from-[#3d5a1f] to-[#5c8a2f]",
  technician: "from-[#4a3b12] to-[#8a6d1f]",
  other: "from-[#2f3d2f] to-[#4a5c4a]",
};

const FAMILY_TAB: Record<CourseFamily, string> = {
  officers: "bg-[#1a5c2e]",
  observation: "bg-[#0f4c5c]",
  artilleryman: "bg-[#3d5a1f]",
  technician: "bg-[#6b5418]",
  other: "bg-[#3a4a3a]",
};

const FAMILY_GLOW: Record<CourseFamily, string> = {
  officers: "group-hover:shadow-[0_12px_28px_-10px_rgba(26,92,46,0.55)]",
  observation: "group-hover:shadow-[0_12px_28px_-10px_rgba(15,76,92,0.55)]",
  artilleryman: "group-hover:shadow-[0_12px_28px_-10px_rgba(61,90,31,0.55)]",
  technician: "group-hover:shadow-[0_12px_28px_-10px_rgba(107,84,24,0.55)]",
  other: "group-hover:shadow-[0_12px_28px_-10px_rgba(47,61,47,0.5)]",
};

function FolderCard({
  course,
  label,
  family,
}: {
  course: CourseFolderRow;
  label: string;
  family: CourseFamily;
}) {
  const intakes = Number(course.intakeCount) || 0;

  return (
    <Link
      href={`/courses/${course.courseId}`}
      prefetch
      className="group relative flex h-full min-h-0 flex-col outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-b-lg"
    >
      {/* Tab */}
      <div
        className={cn(
          "relative z-[1] ml-2.5 h-2.5 w-[36%] shrink-0 rounded-t-[6px] transition-all duration-300 ease-out",
          "group-hover:-translate-y-0.5 group-hover:brightness-110",
          FAMILY_TAB[family]
        )}
      />

      {/* Body */}
      <div
        className={cn(
          "relative z-0 flex flex-1 flex-col overflow-hidden rounded-lg rounded-tl-sm border border-black/10 bg-gradient-to-br p-px",
          "shadow-[0_4px_14px_-8px_rgba(0,0,0,0.28)] transition-all duration-300 ease-out",
          "group-hover:-translate-y-1.5 group-hover:scale-[1.03] group-hover:border-transparent",
          FAMILY_GLOW[family],
          FAMILY_ACCENT[family]
        )}
      >
        {/* Soft highlight sweep on hover */}
        <div
          className="pointer-events-none absolute inset-0 z-10 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-all duration-500 ease-out group-hover:translate-x-[120%] group-hover:opacity-100"
          aria-hidden
        />

        <div className="relative flex flex-1 flex-col rounded-[7px] rounded-tl-sm bg-[linear-gradient(165deg,rgba(255,255,255,0.14),transparent_45%),linear-gradient(180deg,#f8f5ed_0%,#ece5d6_100%)] px-3 pb-2.5 pt-2.5 dark:bg-[linear-gradient(165deg,rgba(255,255,255,0.06),transparent_40%),linear-gradient(180deg,#1c241c_0%,#141a14_100%)]">
          <div className="flex items-center justify-between gap-1.5">
            <FolderOpen
              className="h-3.5 w-3.5 shrink-0 text-[#1a5c2e]/75 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-[-6deg] dark:text-[#7dcea0]"
              strokeWidth={1.75}
            />
            <span
              className={cn(
                "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-px text-[9px] font-semibold tabular-nums transition-colors duration-300",
                intakes > 0
                  ? "bg-[#1a5c2e] text-white group-hover:bg-[#147a35]"
                  : "bg-black/8 text-muted-foreground dark:bg-white/10"
              )}
              title={`${intakes} intake${intakes === 1 ? "" : "s"}`}
            >
              {intakes}
            </span>
          </div>

          <p
            className="mt-2 text-[0.95rem] font-semibold leading-tight tracking-[0.02em] text-[#142016] transition-colors duration-300 group-hover:text-[#0d3d1c] dark:text-[#e8f0e8] dark:group-hover:text-white sm:text-[1.05rem]"
            style={{
              fontFamily: "var(--font-course-display), ui-sans-serif, system-ui",
            }}
          >
            {label}
          </p>

          <div className="mt-auto flex items-end justify-between gap-1 pt-2">
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#5c6b5c] dark:text-[#8fa08f]">
              {intakes === 1 ? "1 intake" : `${intakes} intakes`}
            </p>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a5c2e]/0 text-[#1a5c2e] opacity-0 transition-all duration-300 group-hover:bg-[#1a5c2e]/12 group-hover:opacity-100 dark:text-[#7dcea0]">
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function CoursesFolderGrid({ data }: { data: CourseFolderRow[] }) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => sortCoursesByCatalog(data), [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.display.label.toLowerCase().includes(q) ||
        c.courseCode.toLowerCase().includes(q) ||
        c.courseName.toLowerCase().includes(q)
    );
  }, [sorted, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search course code…"
            className="h-9 border-[#d5d0c4] bg-[#fbf9f4] pl-8 text-sm dark:border-border dark:bg-background"
            aria-label="Search courses"
          />
        </div>
        <p className="text-[11px] tabular-nums text-muted-foreground sm:text-right">
          {filtered.length} course folder{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#cfc8b8] bg-[#fbf9f4]/60 px-6 py-14 text-center dark:border-border dark:bg-muted/20">
          <FolderOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No courses match “{query}”.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((course) => (
            <FolderCard
              key={course.courseId}
              course={course}
              label={course.display.label}
              family={course.display.family}
            />
          ))}
        </div>
      )}
    </div>
  );
}
