import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Grade } from "@/lib/db/schema";

const gradeColors: Record<Grade, string> = {
  A: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  B: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  C: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  D: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  F: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const gradeLabels: Record<Grade, string> = {
  A: "Excellent",
  B: "Very Good",
  C: "Good",
  D: "Pass",
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
        : percentage >= 50
          ? "text-yellow-600"
          : percentage >= 40
            ? "text-orange-600"
            : "text-red-600";

  return (
    <span className={cn("font-medium", colorClass, className)}>
      {percentage.toFixed(1)}%
    </span>
  );
}
