"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { updateEnrollmentStatus } from "../actions";

const STATUS_OPTIONS = [
  { value: "enrolled", label: "Enrolled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed (passed — 55%+)" },
  { value: "incomplete", label: "CT — Ceased Training (below 55%)" },
  { value: "failed", label: "CT — Ceased Training (legacy failed)" },
  { value: "indiscipline", label: "Indiscipline (ceased — 3 year ban)" },
  { value: "withdrawn", label: "Withdrawn" },
] as const;

interface EnrollmentStatusFormProps {
  enrollmentId: number;
  currentStatus: string;
  ceasedAt: string | null;
}

export function EnrollmentStatusForm({
  enrollmentId,
  currentStatus,
  ceasedAt,
}: EnrollmentStatusFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [status, setStatus] = React.useState(currentStatus);
  const needsCeasedDate =
    status === "incomplete" || status === "indiscipline" || status === "failed";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const result = await updateEnrollmentStatus(enrollmentId, formData);

    setPending(false);

    if (result.success) {
      toast.success("Enrollment status updated.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to update status.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
              ceasedAt ? new Date(ceasedAt).toISOString().slice(0, 10) : ""
            }
            required
          />
          <p className="text-xs text-muted-foreground">
            {status === "indiscipline"
              ? "The student cannot enroll in any course for 3 years from this date."
              : "CT — Ceased Training (academic). Student scored below the 55% pass mark."}
          </p>
        </div>
      )}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Update Status"}
      </Button>
    </form>
  );
}
