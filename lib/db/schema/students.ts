import {
  pgTable,
  varchar,
  date,
  boolean,
  timestamp,
  index,
  text,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { genderTypeEnum } from "./enums";
import { enrollments } from "./enrollments";
import { documents } from "./documents";

export const students = pgTable(
  "students",
  {
    armyNumber: varchar("army_number", { length: 20 }).primaryKey(),
    fullName: varchar("full_name", { length: 100 }).notNull(),
    rank: varchar("rank", { length: 30 }).notNull(),
    gender: genderTypeEnum("gender").notNull(),
    dateOfBirth: date("date_of_birth"),
    unit: varchar("unit", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 100 }),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_students_name").on(table.fullName),
    index("idx_students_rank").on(table.rank),
    index("idx_students_unit").on(table.unit),
    index("idx_students_active").on(table.isActive),
  ]
);

export const studentsRelations = relations(students, ({ many }) => ({
  enrollments: many(enrollments),
  documents: many(documents),
}));

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
