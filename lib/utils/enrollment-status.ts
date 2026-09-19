import { DEFAULT_PASSING_MARK } from "./passing-mark";

/** Enrollment status → short UI label */
export const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  enrolled: "Enrolled",
  in_progress: "In progress",
  completed: "Completed",
  failed: "CT — Ceased Training",
  incomplete: "CT — Ceased Training",
  indiscipline: "Indiscipline (ceased)",
  withdrawn: "Withdrawn",
};

export function enrollmentStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return ENROLLMENT_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

/**
 * Academic outcome from average % vs pass mark.
 * Below pass mark → CT ceased training (`incomplete`).
 */
export function academicStatusFromAverage(
  averageMarks: number | null | undefined,
  passingMark: number = DEFAULT_PASSING_MARK
): "completed" | "incomplete" | null {
  if (averageMarks == null || !Number.isFinite(averageMarks)) return null;
  return averageMarks >= passingMark ? "completed" : "incomplete";
}
