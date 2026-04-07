import { db } from "../db";
import { auditLogs, type NewAuditLog } from "../db/schema";
import { headers } from "next/headers";
import type { SessionUser } from "../auth";

export type AuditAction = "create" | "update" | "delete";

export interface AuditOptions {
  user: SessionUser | null;
  action: AuditAction;
  tableName: string;
  recordId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

/**
 * Log an audit event for tracking changes
 */
export async function logAudit(options: AuditOptions): Promise<void> {
  try {
    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    const auditEntry: NewAuditLog = {
      userId: options.user?.userId ?? null,
      userName: options.user?.name ?? "System",
      action: options.action,
      tableName: options.tableName,
      recordId: options.recordId,
      oldValues: options.oldValues ?? null,
      newValues: options.newValues ?? null,
      ipAddress,
      userAgent,
    };

    await db.insert(auditLogs).values(auditEntry);
  } catch (error) {
    // Log error but don't throw - audit logging shouldn't break the main operation
    console.error("Failed to log audit:", error);
  }
}

/**
 * Helper to create audit log for a create operation
 */
export async function auditCreate(
  user: SessionUser | null,
  tableName: string,
  recordId: string,
  newValues: Record<string, unknown>
): Promise<void> {
  await logAudit({
    user,
    action: "create",
    tableName,
    recordId,
    newValues,
  });
}

/**
 * Helper to create audit log for an update operation
 */
export async function auditUpdate(
  user: SessionUser | null,
  tableName: string,
  recordId: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): Promise<void> {
  await logAudit({
    user,
    action: "update",
    tableName,
    recordId,
    oldValues,
    newValues,
  });
}

/**
 * Helper to create audit log for a delete operation
 */
export async function auditDelete(
  user: SessionUser | null,
  tableName: string,
  recordId: string,
  oldValues: Record<string, unknown>
): Promise<void> {
  await logAudit({
    user,
    action: "delete",
    tableName,
    recordId,
    oldValues,
  });
}

/**
 * Get differences between old and new values for cleaner audit logs
 */
export function getChangedFields(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): { old: Record<string, unknown>; new: Record<string, unknown> } {
  const changedOld: Record<string, unknown> = {};
  const changedNew: Record<string, unknown> = {};

  for (const key of Object.keys(newValues)) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changedOld[key] = oldValues[key];
      changedNew[key] = newValues[key];
    }
  }

  return { old: changedOld, new: changedNew };
}
