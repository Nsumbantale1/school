"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download } from "lucide-react";
import { prepareCertificatesForRequest } from "../actions";
import { downloadGraduationCertificatePdf } from "@/lib/utils/certificate-pdf";
import type { CertificateData } from "@/lib/utils/certificate-data";

type Item = {
  enrollmentId: number;
  studentArmyNumber: string;
  fullName: string;
  status: string;
};

export function BatchPrintButton({
  requestId,
  items,
}: {
  requestId: number;
  items: Item[];
}) {
  const router = useRouter();
  const printable = useMemo(
    () => items.filter((i) => i.status === "pending" || i.status === "issued"),
    [items]
  );
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(printable.filter((i) => i.status === "pending").map((i) => i.enrollmentId))
  );
  const [pending, setPending] = useState(false);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePrint() {
    if (selected.size === 0) {
      toast.error("Select at least one student to print.");
      return;
    }
    setPending(true);
    try {
      const result = await prepareCertificatesForRequest(requestId, [
        ...selected,
      ]);
      if (!result.success) {
        toast.error(result.error ?? "Cannot prepare certificates.");
        return;
      }
      const list = result.data as CertificateData[];
      for (const data of list) {
        await downloadGraduationCertificatePdf(data);
      }
      toast.success(`Downloaded ${list.length} certificate(s).`);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed while generating PDFs.");
    } finally {
      setPending(false);
    }
  }

  if (printable.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Print certificates ({selected.size} selected)
        </p>
        <Button type="button" onClick={handlePrint} disabled={pending}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download selected PDFs
        </Button>
      </div>
      <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
        {printable.map((item) => (
          <label
            key={item.enrollmentId}
            className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50"
          >
            <Checkbox
              checked={selected.has(item.enrollmentId)}
              onCheckedChange={() => toggle(item.enrollmentId)}
            />
            <span className="font-mono text-xs">{item.studentArmyNumber}</span>
            <span>{item.fullName}</span>
            <span className="ml-auto text-xs text-muted-foreground capitalize">
              {item.status}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
