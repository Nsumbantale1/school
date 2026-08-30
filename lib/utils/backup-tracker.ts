import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

const BACKUP_TABLE = "system_backup";

export async function getLastBackupDate(): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(eq(auditLogs.tableName, BACKUP_TABLE))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  return row?.createdAt ?? null;
}

export { BACKUP_TABLE };
