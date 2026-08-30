"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { StudentServiceRecord } from "@/lib/utils/student-service-record";
import { downloadServiceRecordPdf } from "@/lib/utils/ssr-pdf";

interface DownloadSsrButtonProps {
  record: StudentServiceRecord;
}

export function DownloadSsrButton({ record }: DownloadSsrButtonProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadServiceRecordPdf(record);
      toast.success("Training Record downloaded.");
    } catch (error) {
      console.error("SSR PDF download error:", error);
      toast.error("Failed to download PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button
      variant="default"
      onClick={handleDownload}
      disabled={downloading}
      className="print:hidden"
    >
      {downloading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Download PDF
    </Button>
  );
}
