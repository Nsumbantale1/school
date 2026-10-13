"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Printer } from "lucide-react";
import { prepareCertificatesForRequest } from "../actions";
import {
  downloadGraduationCertificatesPdf,
  printGraduationCertificates,
} from "@/lib/utils/certificate-pdf";
import type { CertificateData } from "@/lib/utils/certificate-data";

type Item = {
  enrollmentId: number;
  studentArmyNumber: string;
  fullName: string;
  status: string;
};

type Mode = "print-all" | "print-selected" | "download-selected";

export function BatchPrintButton({
  requestId,
  requestNumber,
  items,
}: {
  requestId: number;
  requestNumber: string;
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
  const [pending, setPending] = useState<Mode | null>(null);
  const allSelected = printable.length > 0 && selected.size === printable.length;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(
      allSelected ? new Set() : new Set(printable.map((i) => i.enrollmentId))
    );
  }

  async function run(mode: Mode) {
    const ids =
      mode === "print-all"
        ? printable.map((i) => i.enrollmentId)
        : printable.map((i) => i.enrollmentId).filter((id) => selected.has(id));
    if (ids.length === 0) {
      toast.error("Select at least one student to print.");
      return;
    }
    setPending(mode);
    const progress = toast.loading(`Preparing ${ids.length} certificate(s)…`);
    try {
      const result = await prepareCertificatesForRequest(requestId, ids);
      if (!result.success) {
        toast.error(result.error ?? "Cannot prepare certificates.", { id: progress });
        return;
      }
      const list = result.data as CertificateData[];
      if (mode === "download-selected") {
        await downloadGraduationCertificatesPdf(
          list,
          `Certificates-${requestNumber}-${list.length}.pdf`
        );
        toast.success(`Downloaded ${list.length} certificate(s) in one PDF.`, {
          id: progress,
        });
      } else {
        await printGraduationCertificates(list);
        toast.success(`Sent ${list.length} certificate(s) to the print dialog.`, {
          id: progress,
        });
      }
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed while generating PDFs.", { id: progress });
    } finally {
      setPending(null);
    }
  }

  if (printable.length === 0) return null;

  const busy = pending !== null;
  const icon = (mode: Mode, Icon: typeof Printer) =>
    pending === mode ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <Icon className="mr-2 h-4 w-4" />
    );

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            Print certificates ({printable.length} approved)
          </p>
          <p className="text-xs text-muted-foreground">
            All certificates open in one print dialog, one per page.
          </p>
        </div>
        <Button type="button" onClick={() => run("print-all")} disabled={busy}>
          {icon("print-all", Printer)}
          Print all ({printable.length})
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          Select all ({selected.size} selected)
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => run("print-selected")}
            disabled={busy || selected.size === 0}
          >
            {icon("print-selected", Printer)}
            Print selected
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => run("download-selected")}
            disabled={busy || selected.size === 0}
          >
            {icon("download-selected", Download)}
            Download selected (one PDF)
          </Button>
        </div>
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
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
