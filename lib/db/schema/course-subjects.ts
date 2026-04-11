import {
  pgTable,
  serial,
  varchar,
  integer,
  smallint,
  numeric,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { courses } from "./courses";

export const courseSubjects = pgTable(
  "course_subjects",
  {
    subjectId: serial("subject_id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.courseId, { onDelete: "cascade" }),
    subjectName: varchar("subject_name", { length: 150 }).notNull(),
    maxMarks: numeric("max_marks", { precision: 6, scale: 2 })
      .notNull()
      .default("100"),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("idx_course_subject_unique").on(table.courseId, table.subjectName),
    index("idx_course_subjects_course").on(table.courseId),
  ],
);

export const courseSubjectsRelations = relations(courseSubjects, ({ one }) => ({
  course: one(courses, {
    fields: [courseSubjects.courseId],
    references: [courses.courseId],
  }),
}));

export type CourseSubject = typeof courseSubjects.$inferSelect;
export type NewCourseSubject = typeof courseSubjects.$inferInsert;
