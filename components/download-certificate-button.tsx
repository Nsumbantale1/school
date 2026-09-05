"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Award, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { prepareCertificate } from "@/app/(dashboard)/certificates/actions";
import { downloadGraduationCertificatePdf } from "@/lib/utils/certificate-pdf";
import type { CertificateData } from "@/lib/utils/certificate-data";
import Link from "next/link";

interface DownloadCertificateButtonProps {
  enrollmentId: number;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

export function DownloadCertificateButton({
  enrollmentId,
  variant = "default",
  size = "default",
}: DownloadCertificateButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleDownload() {
    setPending(true);
    try {
      const result = await prepareCertificate(enrollmentId);
      if (!result.success) {
        toast.error(
          result.error ??
            "Cannot generate certificate. It may need dual approval first."
        );
        return;
      }

      await downloadGraduationCertificatePdf(
        result.data as CertificateData
      );
      toast.success("Graduation certificate downloaded.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate certificate PDF.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={pending}
      className="print:hidden"
    >
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Award className="mr-2 h-4 w-4" />
      )}
      Download Certificate
    </Button>
  );
}

export function CertificateSetupHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Need to update signatures?{" "}
      <Link href="/settings/signatures" className="underline">
        Certificate Signatures settings
      </Link>
    </p>
  );
}
