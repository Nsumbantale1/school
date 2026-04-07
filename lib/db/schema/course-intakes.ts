import {
  pgTable,
  serial,
  varchar,
  integer,
  smallint,
  boolean,
  date,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { courses } from "./courses";
import { enrollments } from "./enrollments";

export const courseIntakes = pgTable(
  "course_intakes",
  {
    intakeId: serial("intake_id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.courseId, { onDelete: "cascade" }),
    intakeNumber: varchar("intake_number", { length: 30 }).notNull(), // e.g., "INT-2024-01"
    year: smallint("year").notNull(),
    commanderName: varchar("commander_name", { length: 100 }),
    coordinatorName: varchar("coordinator_name", { length: 100 }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("idx_intake_unique").on(table.courseId, table.intakeNumber),
    index("idx_intakes_course").on(table.courseId),
    index("idx_intakes_year").on(table.year),
    index("idx_intakes_dates").on(table.startDate, table.endDate),
  ]
);

export const courseIntakesRelations = relations(
  courseIntakes,
  ({ one, many }) => ({
    course: one(courses, {
      fields: [courseIntakes.courseId],
      references: [courses.courseId],
    }),
    enrollments: many(enrollments),
  })
);

export type CourseIntake = typeof courseIntakes.$inferSelect;
export type NewCourseIntake = typeof courseIntakes.$inferInsert;
