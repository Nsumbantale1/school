"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

export function SubjectDownloadButton({
  subjectId,
  disabled,
}: {
  subjectId: number;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);

  async function handleDownload() {
    setPending(true);
    try {
      const response = await fetch(
        `/api/course-notices/subjects/${subjectId}/download`
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Download failed.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `subject-${subjectId}-notices.zip`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Notices package downloaded.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to download notices."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={pending || disabled}
      className="gap-2"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Download All Notices
    </Button>
  );
}
