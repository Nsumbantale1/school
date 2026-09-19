export const dynamic = "force-dynamic";

import Link from "next/link";
import { Barlow_Condensed } from "next/font/google";
import { eq, sql } from "drizzle-orm";
import { Presentation, ArrowUpRight, FolderOpen } from "lucide-react";
import { db } from "@/lib/db";
import { presentations } from "@/lib/db/schema";
import { BackButton } from "@/components/back-button";
import { PRESENTATION_CATEGORIES } from "@/lib/utils/presentations";
import { cn } from "@/lib/utils";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-course-display",
});

export default async function PresentationsIndexPage() {
  const counts = await db
    .select({
      category: presentations.category,
      count: sql<number>`count(*)::int`,
    })
    .from(presentations)
    .where(eq(presentations.isActive, true))
    .groupBy(presentations.category);

  const countMap = Object.fromEntries(
    counts.map((c) => [c.category, Number(c.count) || 0])
  );
  const total = Object.values(countMap).reduce((a, b) => a + b, 0);

  return (
    <div className={`space-y-8 ${display.variable}`}>
      <div className="relative overflow-hidden rounded-2xl border border-[#1a5c2e]/20 bg-[radial-gradient(1200px_400px_at_10%_-20%,rgba(26,92,46,0.18),transparent),linear-gradient(165deg,#f7f3ea_0%,#ebe4d4_55%,#e2d9c6_100%)] px-6 py-8 dark:border-border dark:bg-card sm:px-8">
        <div className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full bg-[#1a5c2e]/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1a5c2e]">
              School of Field Artillery · Briefing archive
            </p>
            <div>
              <h1
                className="text-3xl font-semibold tracking-wide text-[#142016] dark:text-[#e8f0e8] sm:text-4xl"
                style={{
                  fontFamily:
                    "var(--font-course-display), ui-sans-serif, system-ui",
                }}
              >
                Presentations
              </h1>
              <p className="mt-1 text-sm text-[#4a5a4a] dark:text-muted-foreground">
                Central archive of SOFA briefs — officer courses, other ranks,
                and external engagements.
              </p>
            </div>
            <p className="text-sm text-[#4a5a4a] dark:text-muted-foreground">
              {total} presentation{total === 1 ? "" : "s"} on file
            </p>
          </div>
          <BackButton fallbackHref="/dashboard" />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {PRESENTATION_CATEGORIES.map((cat) => {
          const n = countMap[cat.key] ?? 0;
          return (
            <Link
              key={cat.key}
              href={`/presentations/${cat.key}`}
              prefetch
              className={cn(
                "group relative flex flex-col outline-none",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              )}
            >
              <div
                className={cn(
                  "relative z-[1] ml-3 h-3 w-[42%] shrink-0 rounded-t-[7px] transition-all duration-300",
                  "group-hover:-translate-y-0.5",
                  cat.tab
                )}
              />
              <div
                className={cn(
                  "relative flex flex-1 flex-col overflow-hidden rounded-2xl rounded-tl-md border border-black/10 bg-gradient-to-br p-px",
                  "transition-all duration-300 group-hover:-translate-y-1.5 group-hover:scale-[1.02]",
                  cat.glow,
                  cat.accent
                )}
              >
                <div className="pointer-events-none absolute inset-0 z-10 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-all duration-500 group-hover:translate-x-[120%] group-hover:opacity-100" />
                <div className="relative flex min-h-[220px] flex-1 flex-col rounded-[15px] rounded-tl-sm bg-[linear-gradient(165deg,rgba(255,255,255,0.16),transparent_45%),linear-gradient(180deg,#f8f5ed_0%,#ece5d6_100%)] p-5 dark:bg-[linear-gradient(165deg,rgba(255,255,255,0.06),transparent_40%),linear-gradient(180deg,#1c241c,#141a14)]">
                  <div className="flex items-start justify-between gap-2">
                    <FolderOpen className="h-5 w-5 text-[#1a5c2e]/85 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg] dark:text-[#7dcea0]" />
                    <span
                      className={cn(
                        "inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                        n > 0
                          ? "bg-[#1a5c2e] text-white"
                          : "bg-black/8 text-muted-foreground dark:bg-white/10"
                      )}
                    >
                      {n}
                    </span>
                  </div>

                  <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b7a6b]">
                    {cat.subtitle}
                  </p>
                  <h2
                    className="mt-1 text-2xl font-semibold leading-none tracking-wide text-[#142016] dark:text-[#e8f0e8]"
                    style={{
                      fontFamily:
                        "var(--font-course-display), ui-sans-serif, system-ui",
                    }}
                  >
                    {cat.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#5c6b5c] dark:text-muted-foreground">
                    {cat.description}
                  </p>

                  <div className="mt-auto flex items-center justify-between pt-6">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#1a5c2e] dark:text-[#7dcea0]">
                      <Presentation className="h-3.5 w-3.5" />
                      Open archive
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full opacity-0 transition-all group-hover:bg-[#1a5c2e]/12 group-hover:opacity-100">
                      <ArrowUpRight className="h-4 w-4 text-[#1a5c2e]" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
