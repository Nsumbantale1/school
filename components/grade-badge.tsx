import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Grade } from "@/lib/db/schema";

const gradeColors: Record<Grade, string> = {
  A: "border-transparent bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-400/10 dark:text-green-300 dark:ring-green-400/25",
  B: "border-transparent bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/25",
  C: "border-transparent bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-400/10 dark:text-yellow-300 dark:ring-yellow-400/25",
  D: "border-transparent bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-400/10 dark:text-orange-300 dark:ring-orange-400/25",
  F: "border-transparent bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25",
};

const gradeLabels: Record<Grade, string> = {
  A: "Excellent",
  B: "Very Good",
  C: "Good",
  D: "Legacy",
  F: "Fail",
};

interface GradeBadgeProps {
  grade: Grade | null | undefined;
  showLabel?: boolean;
  className?: string;
}

export function GradeBadge({ grade, showLabel = false, className }: GradeBadgeProps) {
  if (!grade) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        N/A
      </Badge>
    );
  }

  const colorClass = gradeColors[grade];
  const label = showLabel ? `${grade} - ${gradeLabels[grade]}` : grade;

  return (
    <Badge variant="outline" className={cn(colorClass, className)}>
      {label}
    </Badge>
  );
}

interface GradePercentageProps {
  percentage: number | null | undefined;
  className?: string;
}

export function GradePercentage({ percentage, className }: GradePercentageProps) {
  if (percentage === null || percentage === undefined) {
    return <span className={cn("text-muted-foreground", className)}>-</span>;
  }

  const colorClass =
    percentage >= 80
      ? "text-green-600"
      : percentage >= 60
        ? "text-blue-600"
        : percentage >= 55
          ? "text-yellow-600"
          : "text-red-600";

  return (
    <span className={cn("font-medium", colorClass, className)}>
      {percentage.toFixed(1)}%
    </span>
  );
}
