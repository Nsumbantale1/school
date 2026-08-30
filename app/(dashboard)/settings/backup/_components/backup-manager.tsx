"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Download, Upload, Loader2, HardDrive, AlertTriangle } from "lucide-react";
import { restoreFromBackupFile } from "../actions";

interface BackupSummary {
  tables: number;
  totalRows: number;
  hasSignatures: boolean;
  publicAssets: number;
}

export function BackupManager({ summary }: { summary: BackupSummary }) {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [includeEnv, setIncludeEnv] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const response = await fetch("/api/backup/download");
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Download failed");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] ?? `SOFA-backup-${Date.now()}.zip`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success("Backup downloaded. Copy the .zip file to USB or another computer.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download backup."
      );
    } finally {
      setDownloading(false);
    }
  }

  async function handleRestore(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !confirm(
        "This will REPLACE all current data with the backup. Are you sure?"
      )
    ) {
      return;
    }

    setRestoring(true);
    const formData = new FormData(e.currentTarget);
    formData.set("includeEnv", includeEnv ? "true" : "false");

    const result = await restoreFromBackupFile(formData);
    setRestoring(false);

    if (result.success) {
      toast.success(result.message ?? "Backup restored successfully.");
      e.currentTarget.reset();
    } else {
      toast.error(result.error ?? "Restore failed.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" />
            Download Backup
          </CardTitle>
          <CardDescription>
            Export all school data as a single .zip file. Save it on USB, another
            folder, or another computer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
            <p className="font-medium">Current data in system:</p>
            <ul className="text-muted-foreground space-y-1">
              <li>• {summary.tables} database tables</li>
              <li>• {summary.totalRows.toLocaleString()} total records</li>
              <li>
                • Signatures: {summary.hasSignatures ? "included" : "none"}
              </li>
              <li>• {summary.publicAssets} public assets (logos, images)</li>
            </ul>
          </div>

          <Button onClick={handleDownload} disabled={downloading} className="w-full">
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download Backup (.zip)
          </Button>

          <p className="text-xs text-muted-foreground">
            Tip: After download, copy the file to external storage or another PC
            where you will run the system.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" />
            Restore Backup
          </CardTitle>
          <CardDescription>
            Import a backup .zip on this computer or after moving the system to a
            new machine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRestore} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="backup-file">Backup file (.zip)</Label>
              <Input
                id="backup-file"
                name="backup"
                type="file"
                accept=".zip,application/zip"
                required
              />
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={includeEnv}
                onChange={(e) => setIncludeEnv(e.target.checked)}
              />
              <span>
                Also restore database connection settings (.env.local) from backup
                <span className="block text-xs text-muted-foreground mt-1">
                  Enable this when restoring on a new computer with the same Neon
                  database.
                </span>
              </span>
            </label>

            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Restore replaces all current students, enrollments, results, and
                uploaded files. Download a fresh backup first if unsure.
              </span>
            </div>

            <Button
              type="submit"
              variant="destructive"
              disabled={restoring}
              className="w-full"
            >
              {restoring ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <HardDrive className="mr-2 h-4 w-4" />
              )}
              Restore from Backup
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
