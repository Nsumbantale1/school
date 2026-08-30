import {
  pgTable,
  serial,
  varchar,
  integer,
  smallint,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { enrollmentStatusEnum, gradeEnum } from "./enums";
import { students } from "./students";
import { courseIntakes } from "./course-intakes";
import { results } from "./results";

export const enrollments = pgTable(
  "enrollments",
  {
    enrollmentId: serial("enrollment_id").primaryKey(),
    studentArmyNumber: varchar("student_army_number", { length: 20 })
      .notNull()
      .references(() => students.armyNumber, { onDelete: "cascade" }),
    intakeId: integer("intake_id")
      .notNull()
      .references(() => courseIntakes.intakeId, { onDelete: "cascade" }),
    /** Rank held when enrolled in this course (historical snapshot). */
    rankAtEnrollment: varchar("rank_at_enrollment", { length: 30 }).notNull(),
    /** Unit at time of enrollment (historical snapshot). */
    unitAtEnrollment: varchar("unit_at_enrollment", { length: 100 }),
    status: enrollmentStatusEnum("status").notNull().default("enrolled"),
    totalMarks: numeric("total_marks", { precision: 8, scale: 2 }),
    averageMarks: numeric("average_marks", { precision: 6, scale: 2 }),
    grade: gradeEnum("grade"),
    position: smallint("position"),
    /** When training ceased (incomplete / indiscipline mid-course). */
    ceasedAt: timestamp("ceased_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_enrollment_unique").on(
      table.studentArmyNumber,
      table.intakeId
    ),
    index("idx_enroll_student").on(table.studentArmyNumber),
    index("idx_enroll_intake").on(table.intakeId),
    index("idx_enroll_status").on(table.status),
    index("idx_enroll_grade").on(table.grade),
    index("idx_enroll_position").on(table.position),
  ]
);

export const enrollmentsRelations = relations(
  enrollments,
  ({ one, many }) => ({
    student: one(students, {
      fields: [enrollments.studentArmyNumber],
      references: [students.armyNumber],
    }),
    intake: one(courseIntakes, {
      fields: [enrollments.intakeId],
      references: [courseIntakes.intakeId],
    }),
    results: many(results),
  })
);

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
