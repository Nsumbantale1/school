"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  approveResultChangeAction,
  cancelResultChangeAction,
  rejectResultChangeAction,
} from "../actions";

export function ResultChangeDecision({
  requestId,
  canDecide,
  canCancel,
  approveLabel,
}: {
  requestId: number;
  canDecide: boolean;
  canCancel: boolean;
  approveLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"approve" | "reject" | "cancel" | null>(null);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");

  async function run(
    kind: "approve" | "reject" | "cancel",
    action: () => Promise<{ success: true; message: string } | { success: false; error: string }>
  ) {
    setBusy(kind);
    try {
      const result = await action();
      if (result.success) {
        toast.success(result.message);
        setRejecting(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap gap-2">
          {canDecide && (
            <>
              <Button
                onClick={() => run("approve", () => approveResultChangeAction(requestId))}
                disabled={busy !== null}
              >
                {busy === "approve" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {approveLabel}
              </Button>
              <Button
                variant="outline"
                onClick={() => setRejecting((v) => !v)}
                disabled={busy !== null}
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              onClick={() => run("cancel", () => cancelResultChangeAction(requestId))}
              disabled={busy !== null}
            >
              {busy === "cancel" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="mr-2 h-4 w-4" />
              )}
              Cancel request
            </Button>
          )}
        </div>

        {rejecting && (
          <div className="space-y-2">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this change rejected?"
              rows={3}
            />
            <Button
              variant="destructive"
              size="sm"
              disabled={busy !== null || reason.trim().length < 3}
              onClick={() => run("reject", () => rejectResultChangeAction(requestId, reason))}
            >
              {busy === "reject" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm rejection
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
