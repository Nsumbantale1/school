"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2, Trash2 } from "lucide-react";
import { cleanSignatureImage } from "@/lib/utils/signature-image";
import {
  uploadOfficialSignature,
  updateOfficialDetails,
  deleteOfficialSignature,
} from "../actions";

const TRANSPARENT_GRID: React.CSSProperties = {
  backgroundColor: "#fff",
  backgroundImage:
    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
};

type CleanedUpload = { file: File; url: string };

interface OfficialRow {
  id: number;
  role: "chief_instructor" | "commandant";
  fullName: string | null;
  rankTitle: string | null;
  signatureImagePath: string | null;
  isActive: boolean;
  createdAt: Date;
}

const ROLE_CONFIG = {
  chief_instructor: {
    title: "Chief Instructor",
    titleSw: "Mkufunzi Mkuu",
    description:
      "Left signature on the graduation certificate. Scan signature on white paper, crop tightly, upload PNG.",
  },
  commandant: {
    title: "Commandant",
    titleSw: "Mkuu wa Chuo/Shule",
    description:
      "Right signature on the graduation certificate. Upload when the commandant changes.",
  },
} as const;

function SignatureCard({
  role,
  current,
  readOnly,
}: {
  role: "chief_instructor" | "commandant";
  current: OfficialRow | null;
  readOnly: boolean;
}) {
  const config = ROLE_CONFIG[role];
  const [pending, setPending] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleaned, setCleaned] = useState<CleanedUpload | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (cleaned) URL.revokeObjectURL(cleaned.url);
  }, [cleaned]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCleaned(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setCleaning(true);
    try {
      const result = await cleanSignatureImage(file);
      if (!result) {
        toast.error("No signature ink was found in this image. Try a clearer scan or photo.");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      const clean = new File([result.blob], `${role}-signature.png`, { type: "image/png" });
      setCleaned({ file: clean, url: URL.createObjectURL(result.blob) });
    } catch {
      toast.error("Could not read this image. Use a PNG or JPEG file.");
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setCleaning(false);
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!cleaned) {
      toast.error("Choose a signature image first.");
      return;
    }
    setPending(true);
    const formData = new FormData(form);
    formData.set("signature", cleaned.file);
    const result = await uploadOfficialSignature(formData);
    setPending(false);
    if (result.success) {
      toast.success(`${config.title} signature uploaded.`);
      form.reset();
      setCleaned(null);
    } else {
      toast.error(result.error ?? "Upload failed.");
    }
  }

  async function handleDelete() {
    if (!current) return;
    if (
      !confirm(
        `Remove the ${config.title} signature? New certificates will show a blank signature area until you upload again.`
      )
    ) {
      return;
    }

    setPending(true);
    const result = await deleteOfficialSignature(current.id);
    setPending(false);
    if (result.success) toast.success(`${config.title} signature removed.`);
    else toast.error(result.error ?? "Delete failed.");
  }

  async function handleUpdateDetails(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!current) return;
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("id", String(current.id));
    const result = await updateOfficialDetails(formData);
    setPending(false);
    if (result.success) toast.success("Details updated.");
    else toast.error(result.error ?? "Update failed.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {config.titleSw} / {config.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {current?.signatureImagePath ? (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-xs text-muted-foreground">Current signature</p>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={pending}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Remove
                </Button>
              )}
            </div>
            <div
              className="relative h-40 w-full max-w-sm rounded border"
              style={TRANSPARENT_GRID}
            >
              <Image
                src={current.signatureImagePath}
                alt={`${config.title} signature`}
                fill
                sizes="384px"
                className="object-contain p-3"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
            No signature uploaded yet. Certificates can still be generated — the
            signature area will stay blank until {readOnly ? "the admin uploads one" : "you upload one here"}.
          </p>
        )}

        {current && readOnly && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Rank</dt>
              <dd className="font-medium">{current.rankTitle || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Full name</dt>
              <dd className="font-medium">{current.fullName || "—"}</dd>
            </div>
          </dl>
        )}

        {current && !readOnly && (
          <form onSubmit={handleUpdateDetails} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={current.id} />
            <div className="space-y-1">
              <Label htmlFor={`${role}-rank`}>Rank</Label>
              <Input
                id={`${role}-rank`}
                name="rankTitle"
                defaultValue={current.rankTitle ?? ""}
                placeholder="e.g. Col"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${role}-name`}>Full name</Label>
              <Input
                id={`${role}-name`}
                name="fullName"
                defaultValue={current.fullName ?? ""}
                placeholder="e.g. John Doe"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              Save name & rank
            </Button>
          </form>
        )}

        {!readOnly && (
        <form onSubmit={handleUpload} className="space-y-4 border-t pt-4">
          <input type="hidden" name="role" value={role} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${role}-upload-rank`}>Rank (for new upload)</Label>
              <Input
                id={`${role}-upload-rank`}
                name="rankTitle"
                placeholder="e.g. Col"
                defaultValue={current?.rankTitle ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${role}-upload-name`}>Full name (for new upload)</Label>
              <Input
                id={`${role}-upload-name`}
                name="fullName"
                placeholder="Official name"
                defaultValue={current?.fullName ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${role}-file`}>Signature image (PNG recommended)</Label>
            <Input
              id={`${role}-file`}
              ref={fileRef}
              name="signature"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              required
            />
            <p className="text-xs text-muted-foreground">
              Sign on white paper and scan or photograph it. The paper background and
              shadows are removed automatically; only the ink is kept.
            </p>
          </div>
          {cleaning && (
            <p className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Removing background…
            </p>
          )}
          {cleaned && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Ready to upload. The squares show the background is transparent.
              </p>
              <div
                className="flex h-32 w-full max-w-sm items-center justify-center rounded border p-3"
                style={TRANSPARENT_GRID}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img
                  src={cleaned.url}
                  alt="Cleaned signature preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          )}
          <Button type="submit" disabled={pending || cleaning || !cleaned}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload new signature
          </Button>
        </form>
        )}
      </CardContent>
    </Card>
  );
}

export function SignatureManager({
  chiefInstructor,
  commandant,
  readOnly = false,
}: {
  chiefInstructor: OfficialRow | null;
  commandant: OfficialRow | null;
  readOnly?: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SignatureCard role="chief_instructor" current={chiefInstructor} readOnly={readOnly} />
      <SignatureCard role="commandant" current={commandant} readOnly={readOnly} />
    </div>
  );
}
