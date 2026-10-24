import { Badge } from "@/components/ui/badge";
import { enrollmentStatusLabel } from "@/lib/utils/enrollment-status";

const enrollmentStatusColors: Record<string, string> = {
  enrolled: "border-transparent bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/25",
  in_progress: "border-transparent bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-400/10 dark:text-yellow-300 dark:ring-yellow-400/25",
  completed: "border-transparent bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-400/10 dark:text-green-300 dark:ring-green-400/25",
  failed: "border-transparent bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-400/10 dark:text-orange-300 dark:ring-orange-400/25",
  incomplete: "border-transparent bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25",
  indiscipline: "border-transparent bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-400/10 dark:text-purple-300 dark:ring-purple-400/25",
  withdrawn: "border-transparent bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-400/10 dark:text-gray-300 dark:ring-gray-400/25",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colorClass = enrollmentStatusColors[status] ?? "";
  const label = enrollmentStatusLabel(status);

  return (
    <Badge variant="outline" className={`${colorClass}`}>
      {label}
    </Badge>
  );
}
