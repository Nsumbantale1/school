"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2, Trash2 } from "lucide-react";
import {
  uploadOfficialSignature,
  updateOfficialDetails,
  deleteOfficialSignature,
} from "../actions";

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
}: {
  role: "chief_instructor" | "commandant";
  current: OfficialRow | null;
}) {
  const config = ROLE_CONFIG[role];
  const [pending, setPending] = useState(false);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await uploadOfficialSignature(formData);
    setPending(false);
    if (result.success) {
      toast.success(`${config.title} signature uploaded.`);
      e.currentTarget.reset();
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
            </div>
            <div className="relative h-24 w-full max-w-xs bg-white rounded border">
              <Image
                src={current.signatureImagePath}
                alt={`${config.title} signature`}
                fill
                className="object-contain p-2"
              />
            </div>
            {(current.fullName || current.rankTitle) && (
              <p className="text-sm mt-2">
                {current.rankTitle} {current.fullName}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
            No signature uploaded yet. Certificates can still be generated — the
            signature area will stay blank until you upload one here.
          </p>
        )}

        {current && (
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
              name="signature"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
            />
            <p className="text-xs text-muted-foreground">
              Tip: Scan signature on white paper, crop in CamScanner, save as PNG
              with transparent or white background.
            </p>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload new signature
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function SignatureManager({
  chiefInstructor,
  commandant,
}: {
  chiefInstructor: OfficialRow | null;
  commandant: OfficialRow | null;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SignatureCard role="chief_instructor" current={chiefInstructor} />
      <SignatureCard role="commandant" current={commandant} />
    </div>
  );
}
