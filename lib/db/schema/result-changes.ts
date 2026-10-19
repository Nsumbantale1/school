import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { courseIntakes } from "./course-intakes";
import { enrollments } from "./enrollments";
import { results } from "./results";
import { users } from "./users";

/**
 * A request to change marks that are already recorded.
 * Flow: admin/instructor asks → Chief Instructor approves → Commandant
 * approves → the change is applied.
 */
export const resultChangeRequests = pgTable(
  "result_change_requests",
  {
    id: serial("id").primaryKey(),
    requestNumber: varchar("request_number", { length: 40 }).notNull().unique(),
    intakeId: integer("intake_id")
      .notNull()
      .references(() => courseIntakes.intakeId, { onDelete: "cascade" }),
    /** manual | import | enrollment */
    source: varchar("source", { length: 20 }).notNull(),
    reason: text("reason").notNull(),
    /** pending_chief_instructor | pending_commandant | applied | rejected | cancelled */
    status: varchar("status", { length: 30 }).notNull().default("pending_chief_instructor"),
    requestedBy: integer("requested_by")
      .notNull()
      .references(() => users.id),
    chiefInstructorApprovedBy: integer("chief_instructor_approved_by").references(() => users.id),
    chiefInstructorApprovedAt: timestamp("chief_instructor_approved_at", { withTimezone: true }),
    commandantApprovedBy: integer("commandant_approved_by").references(() => users.id),
    commandantApprovedAt: timestamp("commandant_approved_at", { withTimezone: true }),
    rejectedBy: integer("rejected_by").references(() => users.id),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    rejectedStage: varchar("rejected_stage", { length: 30 }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_result_change_status").on(table.status),
    index("idx_result_change_intake").on(table.intakeId),
    index("idx_result_change_requested_by").on(table.requestedBy),
  ]
);

export const resultChangeItems = pgTable(
  "result_change_items",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => resultChangeRequests.id, { onDelete: "cascade" }),
    /** update_result | delete_result | enrollment_marks */
    kind: varchar("kind", { length: 20 }).notNull(),
    enrollmentId: integer("enrollment_id")
      .notNull()
      .references(() => enrollments.enrollmentId, { onDelete: "cascade" }),
    resultId: integer("result_id").references(() => results.resultId, { onDelete: "set null" }),
    subjectName: varchar("subject_name", { length: 150 }),
    oldMarks: numeric("old_marks", { precision: 6, scale: 2 }),
    oldMaxMarks: numeric("old_max_marks", { precision: 6, scale: 2 }),
    newMarks: numeric("new_marks", { precision: 6, scale: 2 }),
    newMaxMarks: numeric("new_max_marks", { precision: 6, scale: 2 }),
    oldAverage: numeric("old_average", { precision: 6, scale: 2 }),
    newAverage: numeric("new_average", { precision: 6, scale: 2 }),
    oldGrade: varchar("old_grade", { length: 2 }),
    newGrade: varchar("new_grade", { length: 2 }),
    oldPosition: integer("old_position"),
    newPosition: integer("new_position"),
    /** pending | applied | skipped */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    note: text("note"),
  },
  (table) => [
    index("idx_result_change_item_request").on(table.requestId),
    index("idx_result_change_item_enrollment").on(table.enrollmentId),
  ]
);

export const resultChangeRequestsRelations = relations(resultChangeRequests, ({ many, one }) => ({
  items: many(resultChangeItems),
  intake: one(courseIntakes, {
    fields: [resultChangeRequests.intakeId],
    references: [courseIntakes.intakeId],
  }),
}));

export const resultChangeItemsRelations = relations(resultChangeItems, ({ one }) => ({
  request: one(resultChangeRequests, {
    fields: [resultChangeItems.requestId],
    references: [resultChangeRequests.id],
  }),
}));

export type ResultChangeRequest = typeof resultChangeRequests.$inferSelect;
export type ResultChangeItem = typeof resultChangeItems.$inferSelect;
