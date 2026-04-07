import {
  pgTable,
  serial,
  varchar,
  smallint,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { courseIntakes } from "./course-intakes";
import { coursePrerequisites } from "./course-prerequisites";

export const courses = pgTable(
  "courses",
  {
    courseId: serial("course_id").primaryKey(),
    courseCode: varchar("course_code", { length: 20 }).notNull().unique(),
    courseName: varchar("course_name", { length: 150 }).notNull(),
    description: text("description"),
    durationWeeks: smallint("duration_weeks").notNull(),
    passingMark: smallint("passing_mark").notNull().default(40),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_courses_code").on(table.courseCode),
    index("idx_courses_name").on(table.courseName),
    index("idx_courses_active").on(table.isActive),
  ]
);

export const coursesRelations = relations(courses, ({ many }) => ({
  intakes: many(courseIntakes),
  prerequisites: many(coursePrerequisites, { relationName: "course" }),
  requiredFor: many(coursePrerequisites, { relationName: "prerequisite" }),
}));

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
