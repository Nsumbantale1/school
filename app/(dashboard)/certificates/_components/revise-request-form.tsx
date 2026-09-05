"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw } from "lucide-react";
import { reviseCertificateRequest } from "../actions";

type StudentRow = {
  enrollmentId: number;
  armyNumber: string;
  fullName: string;
  rank: string;
  grade: string | null;
};

export function ReviseRequestForm({
  requestId,
  eligible,
  initiallySelected,
  notes: initialNotes,
}: {
  requestId: number;
  eligible: StudentRow[];
  initiallySelected: number[];
  notes: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(initiallySelected)
  );
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [pending, setPending] = useState(false);

  const allIds = useMemo(
    () => eligible.map((s) => s.enrollmentId),
    [eligible]
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleResubmit() {
    if (selected.size === 0) {
      toast.error("Select at least one student.");
      return;
    }
    setPending(true);
    const result = await reviseCertificateRequest({
      requestId,
      enrollmentIds: [...selected],
      notes,
      resubmit: true,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to revise request.");
      return;
    }
    toast.success(
      `Request resubmitted — ${result.certificateCount} certificate(s) pending Chief Instructor.`
    );
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-lg border border-amber-300/50 bg-amber-50/40 p-4 dark:bg-amber-950/20">
      <div>
        <h3 className="text-sm font-semibold">Revise this request</h3>
        <p className="text-xs text-muted-foreground">
          Adjust names, then resubmit the same request for dual approval again.
          Selected: <strong>{selected.size}</strong>
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={eligible.length > 0 && selected.size === eligible.length}
          onCheckedChange={(v) =>
            setSelected(v ? new Set(allIds) : new Set())
          }
        />
        Select all eligible
      </label>
      <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
        {eligible.map((s) => (
          <label
            key={s.enrollmentId}
            className="flex items-center gap-2 rounded px-2 py-1 hover:bg-background/80"
          >
            <Checkbox
              checked={selected.has(s.enrollmentId)}
              onCheckedChange={() => toggle(s.enrollmentId)}
            />
            <span className="font-mono text-xs">{s.armyNumber}</span>
            <span>
              {s.rank} {s.fullName}
            </span>
            <span className="ml-auto text-xs">{s.grade ?? ""}</span>
          </label>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor="revise-notes">Notes</Label>
        <Textarea
          id="revise-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
      <Button type="button" onClick={handleResubmit} disabled={pending}>
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        Resubmit for approval ({selected.size})
      </Button>
    </div>
  );
}
