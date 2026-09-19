"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateIntakeLeadership } from "../actions";

interface IntakeLeadershipFormProps {
  intakeId: number;
  commanderName: string | null;
  coordinatorName: string | null;
}

export function IntakeLeadershipForm({
  intakeId,
  commanderName,
  coordinatorName,
}: IntakeLeadershipFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await updateIntakeLeadership(intakeId, formData);
    setPending(false);

    if (result.success) {
      toast.success("Course leadership saved.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to save.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="commanderName">Course Comd</Label>
        <Input
          id="commanderName"
          name="commanderName"
          placeholder="Fill later — e.g. Capt Juma Ali"
          defaultValue={commanderName ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Course Commander for this intake (optional — fill when known).
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="coordinatorName">Coordinator</Label>
        <Input
          id="coordinatorName"
          name="coordinatorName"
          placeholder="Fill later — e.g. Lt Mary John"
          defaultValue={coordinatorName ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Course Coordinator for this intake (optional — fill when known).
        </p>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
