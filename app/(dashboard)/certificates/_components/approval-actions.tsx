"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X } from "lucide-react";
import {
  approveCertificateRequest,
  rejectCertificateRequest,
} from "../actions";

export function ApprovalActions({
  requestId,
  certificateCount,
  canApprove,
}: {
  requestId: number;
  certificateCount: number;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  if (!canApprove) return null;

  async function handleApprove() {
    setPending(true);
    const result = await approveCertificateRequest(requestId);
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Approval failed.");
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  async function handleReject() {
    if (!reason.trim()) {
      toast.error("Enter a rejection reason.");
      return;
    }
    setPending(true);
    const result = await rejectCertificateRequest(requestId, reason);
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Reject failed.");
      return;
    }
    toast.success("Request rejected. Admin can revise the same request.");
    setRejecting(false);
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-lg border border-[#1a5c2e]/25 bg-[#fbf9f4]/60 p-4 dark:bg-card">
      <p className="text-sm">
        <span className="font-semibold tabular-nums">{certificateCount}</span>{" "}
        certificate{certificateCount === 1 ? "" : "s"} requested for print
        approval.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleApprove} disabled={pending}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setRejecting((v) => !v)}
          disabled={pending}
        >
          <X className="mr-2 h-4 w-4" />
          Reject
        </Button>
      </div>
      {rejecting && (
        <div className="space-y-2">
          <Label htmlFor="reject-reason">Rejection reason</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Explain why this print request is rejected…"
          />
          <Button
            type="button"
            variant="destructive"
            onClick={handleReject}
            disabled={pending}
          >
            Confirm rejection
          </Button>
        </div>
      )}
    </div>
  );
}
