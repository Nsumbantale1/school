import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const loginLogs = pgTable(
  "login_logs",
  {
    logId: serial("log_id").primaryKey(),
    userId: integer("user_id").references(() => users.id),
    username: varchar("username", { length: 50 }).notNull(),
    success: boolean("success").notNull(),
    failureReason: varchar("failure_reason", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_login_user").on(table.userId),
    index("idx_login_username").on(table.username),
    index("idx_login_success").on(table.success),
    index("idx_login_created").on(table.createdAt),
  ]
);

export const loginLogsRelations = relations(loginLogs, ({ one }) => ({
  user: one(users, {
    fields: [loginLogs.userId],
    references: [users.id],
  }),
}));

export type LoginLog = typeof loginLogs.$inferSelect;
export type NewLoginLog = typeof loginLogs.$inferInsert;
