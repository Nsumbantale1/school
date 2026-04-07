import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Trophy, Medal, Award } from "lucide-react";

interface PositionBadgeProps {
  position: number | null | undefined;
  totalStudents?: number;
  className?: string;
}

export function PositionBadge({ position, totalStudents, className }: PositionBadgeProps) {
  if (!position) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        -
      </Badge>
    );
  }

  const positionSuffix = getOrdinalSuffix(position);

  // Top 3 get special styling
  if (position === 1) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 gap-1",
          className
        )}
      >
        <Trophy className="h-3 w-3" />
        1{positionSuffix}
      </Badge>
    );
  }

  if (position === 2) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 gap-1",
          className
        )}
      >
        <Medal className="h-3 w-3" />
        2{positionSuffix}
      </Badge>
    );
  }

  if (position === 3) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 gap-1",
          className
        )}
      >
        <Award className="h-3 w-3" />
        3{positionSuffix}
      </Badge>
    );
  }

  // Regular positions
  return (
    <Badge variant="outline" className={className}>
      {position}
      {positionSuffix}
      {totalStudents && (
        <span className="text-muted-foreground ml-1">/ {totalStudents}</span>
      )}
    </Badge>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

interface PositionTextProps {
  position: number | null | undefined;
  className?: string;
}

export function PositionText({ position, className }: PositionTextProps) {
  if (!position) {
    return <span className={cn("text-muted-foreground", className)}>-</span>;
  }

  const suffix = getOrdinalSuffix(position);

  return (
    <span className={className}>
      {position}
      <sup>{suffix}</sup>
    </span>
  );
}
