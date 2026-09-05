"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderOpen, Search, Megaphone, Layers, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CourseFamily } from "@/lib/utils/course-catalog";
import type { NoticeFolderItem } from "@/lib/utils/notice-course-groups";

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

function FolderCard({ item }: { item: NoticeFolderItem }) {
  const subtitle =
    item.kind === "group"
      ? `${item.levelCount} level${item.levelCount === 1 ? "" : "s"}`
      : "Open notices";

  return (
    <Link
      href={item.href}
      prefetch
      className="group relative flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-b-lg"
    >
      <div
        className={cn(
          "relative z-[1] ml-2.5 h-2.5 w-[36%] shrink-0 rounded-t-[6px] transition-all duration-300 ease-out group-hover:-translate-y-0.5",
          FAMILY_TAB[item.family]
        )}
      />
      <div
        className={cn(
          "relative flex flex-1 flex-col overflow-hidden rounded-lg rounded-tl-sm border border-black/10 bg-gradient-to-br p-px shadow-[0_4px_14px_-8px_rgba(0,0,0,0.28)] transition-all duration-300",
          "group-hover:-translate-y-1.5 group-hover:scale-[1.03]",
          FAMILY_ACCENT[item.family]
        )}
      >
        <div className="pointer-events-none absolute inset-0 z-10 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-all duration-500 group-hover:translate-x-[120%] group-hover:opacity-100" />
        <div className="relative flex flex-1 flex-col rounded-[7px] rounded-tl-sm bg-[linear-gradient(165deg,rgba(255,255,255,0.14),transparent_45%),linear-gradient(180deg,#f8f5ed_0%,#ece5d6_100%)] px-3 pb-2.5 pt-2.5 dark:bg-[linear-gradient(165deg,rgba(255,255,255,0.06),transparent_40%),linear-gradient(180deg,#1c241c,#141a14)]">
          <div className="flex items-center justify-between gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 text-[#1a5c2e]/80 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg] dark:text-[#7dcea0]" />
            <span
              className={cn(
                "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-px text-[9px] font-semibold tabular-nums",
                item.noticeCount > 0
                  ? "bg-[#1a5c2e] text-white"
                  : "bg-black/8 text-muted-foreground dark:bg-white/10"
              )}
            >
              {item.noticeCount}
            </span>
          </div>

          <p
            className="mt-2 text-[0.95rem] font-semibold leading-tight tracking-[0.02em] text-[#142016] dark:text-[#e8f0e8] sm:text-[1.05rem]"
            style={{
              fontFamily: "var(--font-course-display), ui-sans-serif, system-ui",
            }}
          >
            {item.title}
          </p>

          <div className="mt-auto flex items-end justify-between gap-1 pt-2">
            <div className="space-y-0.5">
              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#5c6b5c] dark:text-[#8fa08f]">
                {subtitle}
              </p>
              <p className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <Megaphone className="h-2.5 w-2.5" />
                {item.noticeCount} notice{item.noticeCount === 1 ? "" : "s"}
                {item.kind === "group" && (
                  <>
                    <span className="mx-0.5">·</span>
                    <Layers className="h-2.5 w-2.5" />
                    {item.levelCount}
                  </>
                )}
              </p>
            </div>
            <span className="flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-all group-hover:bg-[#1a5c2e]/12 group-hover:opacity-100">
              <ArrowUpRight className="h-3 w-3 text-[#1a5c2e] dark:text-[#7dcea0]" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function NoticesCourseFolders({
  folders,
}: {
  folders: NoticeFolderItem[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.title.toLowerCase().includes(q));
  }, [folders, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search course…"
            className="h-9 border-[#d5d0c4] bg-[#fbf9f4] pl-8 text-sm dark:border-border dark:bg-background"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {filtered.length} course folder{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#cfc8b8] px-6 py-14 text-center text-sm text-muted-foreground dark:border-border">
          No course folders found.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((item) => (
            <FolderCard key={item.key} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
