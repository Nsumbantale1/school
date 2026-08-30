const TZ = "Africa/Dar_es_Salaam";

export function isFridayInTanzania(date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: TZ,
  }).format(date);
  return weekday === "Fri";
}

export function formatDateInTanzania(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

/** Show reminder on Fridays unless a backup was already done today. */
export function shouldShowFridayBackupReminder(
  lastBackupAt: Date | null,
  now = new Date()
): boolean {
  if (!isFridayInTanzania(now)) return false;
  if (!lastBackupAt) return true;

  const today = formatDateInTanzania(now);
  const lastBackupDay = formatDateInTanzania(lastBackupAt);
  return lastBackupDay !== today;
}

export function formatLastBackupLabel(lastBackupAt: Date | null): string {
  if (!lastBackupAt) return "Never";
  return lastBackupAt.toLocaleString("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
