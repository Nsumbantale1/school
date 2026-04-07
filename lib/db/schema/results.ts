import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { gradeEnum } from "./enums";
import { enrollments } from "./enrollments";
import { users } from "./users";

export const results = pgTable(
  "results",
  {
    resultId: serial("result_id").primaryKey(),
    enrollmentId: integer("enrollment_id")
      .notNull()
      .references(() => enrollments.enrollmentId, { onDelete: "cascade" }),
    subjectName: varchar("subject_name", { length: 150 }).notNull(), // Inline subject, no separate table
    marksObtained: numeric("marks_obtained", {
      precision: 6,
      scale: 2,
    }).notNull(),
    maxMarks: numeric("max_marks", { precision: 6, scale: 2 })
      .notNull()
      .default("100"),
    grade: gradeEnum("grade"), // Auto-calculated
    remarks: text("remarks"),
    enteredBy: integer("entered_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("idx_result_unique").on(table.enrollmentId, table.subjectName),
    index("idx_result_enrollment").on(table.enrollmentId),
    index("idx_result_subject").on(table.subjectName),
    index("idx_result_grade").on(table.grade),
    index("idx_result_entered_by").on(table.enteredBy),
  ]
);

export const resultsRelations = relations(results, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [results.enrollmentId],
    references: [enrollments.enrollmentId],
  }),
  enteredByUser: one(users, {
    fields: [results.enteredBy],
    references: [users.id],
  }),
}));

export type Result = typeof results.$inferSelect;
export type NewResult = typeof results.$inferInsert;
