"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateEnrollment } from "../actions";
import { BackButton } from "@/components/back-button";
import Link from "next/link";

const GRADE_OPTIONS = ["A", "B", "C", "D", "F"] as const;

const STATUS_OPTIONS = [
  { value: "enrolled", label: "Enrolled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed (passed — 55%+)" },
  { value: "failed", label: "Failed" },
  { value: "incomplete", label: "CT — Ceased training" },
  { value: "indiscipline", label: "CT — Indiscipline" },
  { value: "withdrawn", label: "Withdrawn" },
] as const;

export type EnrollmentEditInitial = {
  enrollmentId: number;
  rankAtEnrollment: string;
  unitAtEnrollment: string | null;
  status: string;
  ceasedAt: string | null;
  averageMarks: string | null;
  grade: string | null;
  position: number | null;
  pendingChange?: { id: number; requestNumber: string } | null;
};

export function EnrollmentEditForm({
  initialData,
}: {
  initialData: EnrollmentEditInitial;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [status, setStatus] = React.useState(initialData.status);
  const marksRecorded =
    initialData.averageMarks != null || initialData.grade != null || initialData.position != null;
  const needsCeasedDate =
    status === "incomplete" || status === "indiscipline" || status === "failed";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const result = await updateEnrollment(initialData.enrollmentId, formData);

    setPending(false);

    if (result.success && "pendingApproval" in result && result.pendingApproval) {
      toast.success(result.message, { duration: 8000 });
      router.push(`/results/changes/${result.requestId}`);
      router.refresh();
    } else if (result.success) {
      toast.success("Enrollment updated.");
      router.push(`/enrollments/${initialData.enrollmentId}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to update enrollment.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Course snapshot
        </h3>
        <div className="space-y-2">
          <Label htmlFor="rankAtEnrollment">Rank at course</Label>
          <Input
            id="rankAtEnrollment"
            name="rankAtEnrollment"
            defaultValue={initialData.rankAtEnrollment}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unitAtEnrollment">Unit then</Label>
          <Input
            id="unitAtEnrollment"
            name="unitAtEnrollment"
            defaultValue={initialData.unitAtEnrollment ?? ""}
            placeholder="e.g. SOFA"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {needsCeasedDate && (
          <div className="space-y-2">
            <Label htmlFor="ceasedAt">Date training ceased</Label>
            <Input
              id="ceasedAt"
              name="ceasedAt"
              type="date"
              defaultValue={
                initialData.ceasedAt
                  ? new Date(initialData.ceasedAt).toISOString().slice(0, 10)
                  : ""
              }
              required
            />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Performance summary
        </h3>
        {marksRecorded && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            These marks are already recorded. Changing average, grade or position sends a request
            to the Chief Instructor and then the Commandant; the marks change only after both
            approve.
          </p>
        )}
        {initialData.pendingChange && (
          <p className="text-xs">
            A change is already waiting for approval:{" "}
            <Link
              href={`/results/changes/${initialData.pendingChange.id}`}
              className="font-medium underline"
            >
              {initialData.pendingChange.requestNumber}
            </Link>
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="averageMarks">Average marks (%)</Label>
          <Input
            id="averageMarks"
            name="averageMarks"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={
              initialData.averageMarks != null
                ? parseFloat(initialData.averageMarks).toFixed(2)
                : ""
            }
            placeholder="e.g. 67.21"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="grade">Grade</Label>
          <select
            id="grade"
            name="grade"
            defaultValue={initialData.grade ?? ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="position">Position in class</Label>
          <Input
            id="position"
            name="position"
            type="number"
            min="1"
            step="1"
            defaultValue={initialData.position ?? ""}
            placeholder="e.g. 19"
          />
        </div>
        {marksRecorded && (
          <div className="space-y-2">
            <Label htmlFor="changeReason">Reason for changing marks</Label>
            <Input
              id="changeReason"
              name="changeReason"
              placeholder="Only needed if you change average, grade or position"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
        <BackButton
          fallbackHref={`/enrollments/${initialData.enrollmentId}`}
          label="Cancel"
        />
      </div>
    </form>
  );
}
