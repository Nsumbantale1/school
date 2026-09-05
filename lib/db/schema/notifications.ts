import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

/** In-app inbox for officials (CI, Commandant, Admin). */
export const appNotifications = pgTable(
  "app_notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    href: varchar("href", { length: 255 }),
    kind: varchar("kind", { length: 40 }).notNull().default("info"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_app_notifications_user").on(table.userId),
    index("idx_app_notifications_unread").on(table.userId, table.isRead),
  ]
);

export const appNotificationsRelations = relations(
  appNotifications,
  ({ one }) => ({
    user: one(users, {
      fields: [appNotifications.userId],
      references: [users.id],
    }),
  })
);

export type AppNotification = typeof appNotifications.$inferSelect;
