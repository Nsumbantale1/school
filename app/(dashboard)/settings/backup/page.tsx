export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { requireRole } from "@/lib/auth/guards";
import { getBackupSummary } from "./actions";
import { BackupManager } from "./_components/backup-manager";

export default async function BackupSettingsPage() {
  await requireRole(["admin"]);

  const result = await getBackupSummary();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Backup & Restore"
          description="Download or restore a full copy of school data."
        >
          <BackButton fallbackHref="/dashboard" />
        </PageHeader>
        <p className="text-destructive">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backup & Restore"
        description="Download a portable .zip backup and move it to USB, another folder, or another computer. Restore the same file when setting up the system elsewhere."
      >
        <BackButton fallbackHref="/dashboard" />
      </PageHeader>

      <BackupManager summary={result.summary} />
    </div>
  );
}
