"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, HardDrive, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatDateInTanzania,
  formatLastBackupLabel,
  shouldShowFridayBackupReminder,
} from "@/lib/utils/backup-reminder";

interface BackupFridayReminderProps {
  lastBackupAt: string | null;
}

const NOTIFICATION_TITLE = "SOFA — Friday Backup Reminder";
const NOTIFICATION_BODY =
  "It's Friday. Download a full school data backup and save it to USB or another storage location.";

export function BackupFridayReminder({
  lastBackupAt,
}: BackupFridayReminderProps) {
  const lastBackup = lastBackupAt ? new Date(lastBackupAt) : null;
  const shouldRemind = shouldShowFridayBackupReminder(lastBackup);
  const [dismissed, setDismissed] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(false);

  useEffect(() => {
    if (!shouldRemind || dismissed) return;

    const today = formatDateInTanzania(new Date());
    const dismissKey = `sofa-backup-dismissed-${today}`;
    if (localStorage.getItem(dismissKey) === "1") {
      setDismissed(true);
      return;
    }

    if (typeof Notification === "undefined") return;

    setNotificationsOn(Notification.permission === "granted");

    if (Notification.permission !== "granted") return;

    const notifyKey = `sofa-backup-notified-${today}`;
    if (sessionStorage.getItem(notifyKey) === "1") return;

    try {
      new Notification(NOTIFICATION_TITLE, {
        body: NOTIFICATION_BODY,
        tag: "sofa-friday-backup",
        requireInteraction: true,
      });
      sessionStorage.setItem(notifyKey, "1");
    } catch {
      // notifications blocked or unsupported
    }
  }, [shouldRemind, dismissed]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;

    const permission = await Notification.requestPermission();
    setNotificationsOn(permission === "granted");

    if (permission === "granted") {
      try {
        new Notification(NOTIFICATION_TITLE, { body: NOTIFICATION_BODY });
      } catch {
        // ignore
      }
    }
  }

  function dismissForToday() {
    const today = formatDateInTanzania(new Date());
    localStorage.setItem(`sofa-backup-dismissed-${today}`, "1");
    setDismissed(true);
  }

  if (!shouldRemind || dismissed) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold">Friday Reminder — Run Backup</p>
          <p className="text-amber-900/90 dark:text-amber-100/90">
            It&apos;s Friday. Download a full backup and save it to USB, another
            folder, or another computer.
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
            Last backup: {formatLastBackupLabel(lastBackup)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {typeof Notification !== "undefined" &&
          Notification.permission === "default" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-400 bg-white/80"
              onClick={enableNotifications}
            >
              <Bell className="mr-1.5 h-3.5 w-3.5" />
              Enable alerts
            </Button>
          )}
        {notificationsOn && (
          <span className="text-xs text-amber-800 dark:text-amber-200">
            Alerts enabled
          </span>
        )}
        <Button asChild size="sm">
          <Link href="/settings/backup">
            <HardDrive className="mr-1.5 h-3.5 w-3.5" />
            Run Backup
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={dismissForToday}
          aria-label="Dismiss reminder for today"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
