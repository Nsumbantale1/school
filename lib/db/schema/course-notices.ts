import {
  pgTable,
  serial,
  varchar,
  integer,
  smallint,
  boolean,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  noticeCategoryEnum,
  noticePriorityEnum,
  exerciseTypeEnum,
} from "./enums";
import { courses } from "./courses";
import { courseSubjects } from "./course-subjects";
import { users } from "./users";

export const courseNotices = pgTable(
  "course_notices",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.courseId, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => courseSubjects.subjectId, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    category: noticeCategoryEnum("category").notNull().default("general"),
    priority: noticePriorityEnum("priority").notNull().default("normal"),
    attachmentPath: varchar("attachment_path", { length: 500 }),
    attachmentName: varchar("attachment_name", { length: 255 }),
    isPinned: boolean("is_pinned").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_course_notices_course").on(table.courseId),
    index("idx_course_notices_subject").on(table.subjectId),
    index("idx_course_notices_pinned").on(table.isPinned),
    index("idx_course_notices_created").on(table.createdAt),
  ]
);

export const courseExercises = pgTable(
  "course_exercises",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.courseId, { onDelete: "cascade" }),
    weekNumber: smallint("week_number").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    exerciseType: exerciseTypeEnum("exercise_type").notNull().default("other"),
    location: varchar("location", { length: 150 }),
    duration: varchar("duration", { length: 80 }),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_course_exercises_course").on(table.courseId),
    index("idx_course_exercises_week").on(table.weekNumber),
  ]
);

export const courseNoticesRelations = relations(courseNotices, ({ one }) => ({
  course: one(courses, {
    fields: [courseNotices.courseId],
    references: [courses.courseId],
  }),
  subject: one(courseSubjects, {
    fields: [courseNotices.subjectId],
    references: [courseSubjects.subjectId],
  }),
  author: one(users, {
    fields: [courseNotices.createdBy],
    references: [users.id],
  }),
}));

export const courseExercisesRelations = relations(courseExercises, ({ one }) => ({
  course: one(courses, {
    fields: [courseExercises.courseId],
    references: [courses.courseId],
  }),
  author: one(users, {
    fields: [courseExercises.createdBy],
    references: [users.id],
  }),
}));

export type CourseNotice = typeof courseNotices.$inferSelect;
export type CourseExercise = typeof courseExercises.$inferSelect;
