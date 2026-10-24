"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { closeProgressAuthority, requestProgressAuthority } from "../authority-actions";

export function EditAuthority({
  intakeId,
  mode,
}: {
  intakeId: number;
  mode: "ask" | "pending" | "granted";
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await requestProgressAuthority(intakeId, reason);
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Could not send the request.");
      return;
    }
    toast.success("Sent to the Chief Instructor.");
    setReason("");
    router.refresh();
  }

  async function lockAgain() {
    setPending(true);
    const result = await closeProgressAuthority(intakeId);
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Could not lock the marks.");
      return;
    }
    toast.success("Recorded marks are locked again.");
    router.refresh();
  }

  if (mode === "granted") {
    return (
      <div className="rounded-lg border border-[#1a5c2e]/30 bg-[#1a5c2e]/5 px-4 py-3 text-sm print:hidden">
        <p>The Chief Instructor authorized you to correct these recorded marks.</p>
        <Button type="button" size="sm" variant="outline" className="mt-3" disabled={pending} onClick={() => void lockAgain()}>
          {pending ? "Locking…" : "Finish and lock again"}
        </Button>
      </div>
    );
  }

  if (mode === "pending") {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 print:hidden">
        Waiting for the Chief Instructor. Recorded marks stay locked until that authority is given.
      </div>
    );
  }

  return (
    <form onSubmit={ask} className="space-y-3 rounded-lg border px-4 py-3 print:hidden">
      <p className="text-sm">
        Recorded marks cannot be edited. Ask the Chief Instructor for authority if a saved mark must change.
      </p>
      <Textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        required
        minLength={8}
        placeholder="Which mark is wrong, and what should it be?"
        rows={3}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Ask Chief Instructor"}
      </Button>
    </form>
  );
}
