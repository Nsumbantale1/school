import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { auditActionEnum } from "./enums";

export const auditLogs = pgTable(
  "audit_logs",
  {
    logId: serial("log_id").primaryKey(),
    userId: integer("user_id"), // Can be null for system actions
    userName: varchar("user_name", { length: 100 }),
    action: auditActionEnum("action").notNull(),
    tableName: varchar("table_name", { length: 50 }).notNull(),
    recordId: varchar("record_id", { length: 50 }).notNull(),
    oldValues: jsonb("old_values"), // Previous state
    newValues: jsonb("new_values"), // New state
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_audit_user").on(table.userId),
    index("idx_audit_action").on(table.action),
    index("idx_audit_table").on(table.tableName),
    index("idx_audit_record").on(table.recordId),
    index("idx_audit_created").on(table.createdAt),
  ]
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
