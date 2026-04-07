import { Badge } from "@/components/ui/badge";

const enrollmentStatusColors: Record<string, string> = {
  enrolled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colorClass = enrollmentStatusColors[status] ?? "";
  const label = status.replace(/_/g, " ");

  return (
    <Badge variant="outline" className={`capitalize ${colorClass}`}>
      {label}
    </Badge>
  );
}
