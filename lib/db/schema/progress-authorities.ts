import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { courseIntakes } from "./course-intakes";
import { users } from "./users";

/** Coordinator asks the Chief Instructor before changing weekly marks already saved. */
export const progressEditAuthorities = pgTable(
  "progress_edit_authorities",
  {
    id: serial("id").primaryKey(),
    intakeId: integer("intake_id")
      .notNull()
      .references(() => courseIntakes.intakeId, { onDelete: "cascade" }),
    requestedBy: integer("requested_by")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    /** pending | granted | rejected | closed */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    decidedBy: integer("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_progress_auth_intake").on(table.intakeId),
    index("idx_progress_auth_status").on(table.status),
  ]
);

export type ProgressEditAuthority = typeof progressEditAuthorities.$inferSelect;
