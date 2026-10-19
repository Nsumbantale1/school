"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateEnrollmentStatus } from "@/app/(dashboard)/enrollments/actions";

const OPTIONS = [
  { value: "enrolled", label: "Enrolled" },
  { value: "in_progress", label: "In progress" },
  { value: "failed", label: "Failed" },
  { value: "incomplete", label: "CT" },
  { value: "indiscipline", label: "CT — Indiscipline" },
] as const;

const KNOWN = new Set<string>(OPTIONS.map((option) => option.value));

export function OngoingStatusControl({
  enrollmentId,
  status,
  ceasedAt,
}: {
  enrollmentId: number;
  status: string;
  ceasedAt: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(KNOWN.has(status) ? status : "enrolled");
  const [date, setDate] = useState(ceasedAt ? ceasedAt.slice(0, 10) : "");
  const [pending, setPending] = useState(false);
  const needsDate =
    value === "failed" || value === "incomplete" || value === "indiscipline";
  const savedDate = ceasedAt ? ceasedAt.slice(0, 10) : "";
  const dirty = value !== status || (needsDate && date !== savedDate);

  async function save() {
    setPending(true);
    const formData = new FormData();
    formData.set("status", value);
    if (needsDate) formData.set("ceasedAt", date);
    const result = await updateEnrollmentStatus(enrollmentId, formData);
    setPending(false);
    if (result.success) {
      toast.success("Student status saved.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not save status.");
    }
  }

  return (
    <div className="relative z-20 flex flex-wrap items-center gap-2">
      <select
        aria-label="Student status"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {needsDate && (
        <input
          aria-label="Date training ceased"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          required
        />
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8"
        disabled={pending || !dirty || (needsDate && !date)}
        onClick={save}
      >
        {pending ? "Saving" : "Save"}
      </Button>
    </div>
  );
}
