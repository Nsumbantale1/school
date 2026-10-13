import {
  pgTable,
  serial,
  integer,
  smallint,
  numeric,
  varchar,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { enrollments } from "./enrollments";
import { users } from "./users";

/** Week-by-week and monthly progress-chart marks. Kept out of final course results. */
export const progressTests = pgTable(
  "progress_tests",
  {
    id: serial("id").primaryKey(),
    enrollmentId: integer("enrollment_id")
      .notNull()
      .references(() => enrollments.enrollmentId, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 16 }).notNull(),
    period: smallint("period").notNull(),
    marks: numeric("marks", { precision: 6, scale: 2 }).notNull(),
    updatedBy: integer("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("idx_progress_test_unique").on(
      table.enrollmentId,
      table.kind,
      table.period
    ),
    index("idx_progress_test_enrollment").on(table.enrollmentId),
  ]
);

export type ProgressTest = typeof progressTests.$inferSelect;
