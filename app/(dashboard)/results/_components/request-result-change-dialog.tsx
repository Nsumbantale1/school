"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calculateGrade } from "@/lib/utils/grades";
import { requestResultChange } from "../actions";

type Target = {
  resultId: number;
  rank: string;
  fullName: string;
  studentArmyNumber: string;
  subjectName: string;
  marksObtained: string;
  maxMarks: string;
  grade: string | null;
};

export function RequestResultChangeDialog({
  result,
  onOpenChange,
}: {
  result: Target | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [action, setAction] = React.useState<"update" | "delete">("update");
  const [marks, setMarks] = React.useState("");
  const [max, setMax] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!result) return;
    setAction("update");
    setMarks(String(parseFloat(result.marksObtained)));
    setMax(String(parseFloat(result.maxMarks)));
    setReason("");
  }, [result]);

  const newMarks = parseFloat(marks);
  const newMax = parseFloat(max);
  const previewGrade =
    Number.isFinite(newMarks) && Number.isFinite(newMax) && newMax > 0
      ? calculateGrade(newMarks, newMax)
      : null;

  async function submit() {
    if (!result) return;
    setSaving(true);
    try {
      const res = await requestResultChange({
        resultId: result.resultId,
        action,
        marksObtained: newMarks,
        maxMarks: newMax,
        reason,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Request ${res.requestNumber} sent. The Chief Instructor and then the Commandant must approve before the marks change.`,
        { duration: 8000 }
      );
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!result} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a result change</DialogTitle>
          <DialogDescription>
            Recorded marks change only after the Chief Instructor and then the Commandant approve.
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
              <p className="font-medium">
                {result.rank} {result.fullName}{" "}
                <span className="font-mono text-muted-foreground">({result.studentArmyNumber})</span>
              </p>
              <p className="text-muted-foreground">
                {result.subjectName}: {parseFloat(result.marksObtained).toFixed(1)} /{" "}
                {parseFloat(result.maxMarks).toFixed(0)}
                {result.grade ? ` · grade ${result.grade}` : ""}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={action === "update" ? "default" : "outline"}
                onClick={() => setAction("update")}
              >
                Correct marks
              </Button>
              <Button
                type="button"
                size="sm"
                variant={action === "delete" ? "destructive" : "outline"}
                onClick={() => setAction("delete")}
              >
                Remove this result
              </Button>
            </div>

            {action === "update" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rc-marks">New marks</Label>
                  <Input
                    id="rc-marks"
                    type="number"
                    step="0.01"
                    min={0}
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rc-max">Out of</Label>
                  <Input
                    id="rc-max"
                    type="number"
                    step="0.01"
                    min={1}
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                  />
                </div>
                {previewGrade && (
                  <p className="col-span-2 text-xs text-muted-foreground">
                    New grade will be <span className="font-semibold">{previewGrade}</span>.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="rc-reason">Reason</Label>
              <Textarea
                id="rc-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Script re-marked after appeal; clerical error when entering marks"
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || reason.trim().length < 5}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
