"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideProgressAuthority } from "../authority-actions";

export function AuthorityDecision({ id }: { id: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function decide(decision: "granted" | "rejected") {
    setPending(true);
    const result = await decideProgressAuthority(id, decision, "");
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Could not save the decision.");
      return;
    }
    toast.success(decision === "granted" ? "Authority granted." : "Request refused.");
    router.refresh();
  }

  return (
    <div className="mt-3 flex gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={() => void decide("granted")}>
        Grant authority
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void decide("rejected")}>
        Refuse
      </Button>
    </div>
  );
}
