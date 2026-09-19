import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  boolean,
  timestamp,
  date,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { presentationCategoryEnum } from "./enums";
import { users } from "./users";

/**
 * Briefing / lecture presentations delivered by SOFA:
 * officers courses, other ranks, or external venues.
 */
export const presentations = pgTable(
  "presentations",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    category: presentationCategoryEnum("category").notNull(),
    description: text("description"),
    /** Who delivered / owns the brief */
    presenterName: varchar("presenter_name", { length: 120 }),
    /** Audience or hosting unit (esp. external) */
    audience: varchar("audience", { length: 200 }),
    /** Venue / location */
    venue: varchar("venue", { length: 200 }),
    presentedAt: date("presented_at"),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    uploadedBy: integer("uploaded_by")
      .notNull()
      .references(() => users.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_presentations_category").on(table.category),
    index("idx_presentations_presented_at").on(table.presentedAt),
    index("idx_presentations_active").on(table.isActive),
  ]
);

export const presentationsRelations = relations(presentations, ({ one }) => ({
  uploader: one(users, {
    fields: [presentations.uploadedBy],
    references: [users.id],
  }),
}));

export type Presentation = typeof presentations.$inferSelect;
export type NewPresentation = typeof presentations.$inferInsert;
