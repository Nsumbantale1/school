import {
  pgTable,
  serial,
  integer,
  boolean,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { courses } from "./courses";

export const coursePrerequisites = pgTable(
  "course_prerequisites",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.courseId, { onDelete: "cascade" }),
    prerequisiteCourseId: integer("prerequisite_course_id")
      .notNull()
      .references(() => courses.courseId, { onDelete: "cascade" }),
    isOptional: boolean("is_optional").notNull().default(false), // true for "one of" requirements
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("idx_prereq_unique").on(table.courseId, table.prerequisiteCourseId),
    index("idx_prereq_course").on(table.courseId),
    index("idx_prereq_prereq").on(table.prerequisiteCourseId),
  ]
);

export const coursePrerequisitesRelations = relations(
  coursePrerequisites,
  ({ one }) => ({
    course: one(courses, {
      fields: [coursePrerequisites.courseId],
      references: [courses.courseId],
      relationName: "course",
    }),
    prerequisiteCourse: one(courses, {
      fields: [coursePrerequisites.prerequisiteCourseId],
      references: [courses.courseId],
      relationName: "prerequisite",
    }),
  })
);

export type CoursePrerequisite = typeof coursePrerequisites.$inferSelect;
export type NewCoursePrerequisite = typeof coursePrerequisites.$inferInsert;
