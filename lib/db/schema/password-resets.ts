import { pgTable, serial, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * "Forgot password" requests. Without email the admin is alerted and sets a
 * new password; with email a single-use link (stored hashed) is sent.
 */
export const passwordResetRequests = pgTable(
  "password_reset_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** open | resolved | used */
    status: varchar("status", { length: 20 }).notNull().default("open"),
    requestedIp: varchar("requested_ip", { length: 64 }),
    resolvedBy: integer("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_password_reset_user").on(table.userId),
    index("idx_password_reset_status").on(table.status),
    index("idx_password_reset_token").on(table.tokenHash),
  ]
);

export type PasswordResetRequest = typeof passwordResetRequests.$inferSelect;
