import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type StatTone = "primary" | "highlight" | "maroon" | "blue" | "olive" | "slate";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  tone?: StatTone;
}

const toneStyles: Record<StatTone, { tile: string; bar: string }> = {
  primary: {
    tile: "bg-primary/10 text-primary",
    bar: "from-primary/70 to-primary",
  },
  highlight: {
    tile: "bg-highlight/25 text-highlight-foreground dark:bg-highlight/15 dark:text-highlight",
    bar: "from-highlight-deep to-highlight",
  },
  maroon: {
    tile: "bg-maroon/10 text-maroon dark:bg-maroon/20",
    bar: "from-maroon-strong to-maroon",
  },
  blue: {
    tile: "bg-sky-600/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
    bar: "from-sky-600 to-cyan-400",
  },
  olive: {
    tile: "bg-[oklch(0.55_0.08_125/0.12)] text-[oklch(0.42_0.08_125)] dark:text-[oklch(0.78_0.09_125)]",
    bar: "from-[oklch(0.45_0.08_125)] to-[oklch(0.65_0.09_120)]",
  },
  slate: {
    tile: "bg-slate-600/10 text-slate-700 dark:bg-slate-300/15 dark:text-slate-200",
    bar: "from-slate-600 to-slate-400",
  },
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "primary",
}: StatCardProps) {
  const styles = toneStyles[tone];
  return (
    <Card className="relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <span
        className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", styles.bar)}
      />
      <CardContent className="flex items-start justify-between gap-4 pt-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-tight">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", styles.tile)}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
