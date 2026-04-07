import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userRoleEnum } from "./enums";
import { courses } from "./courses";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    role: userRoleEnum("role").notNull().default("viewer"),
    // For instructor: which course they can manage results for
    assignedCourseId: integer("assigned_course_id").references(
      () => courses.courseId,
      { onDelete: "set null" }
    ),
    isActive: boolean("is_active").notNull().default(true),
    lastLogin: timestamp("last_login", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_users_username").on(table.username),
    index("idx_users_role").on(table.role),
    index("idx_users_assigned_course").on(table.assignedCourseId),
  ]
);

export const usersRelations = relations(users, ({ one }) => ({
  assignedCourse: one(courses, {
    fields: [users.assignedCourseId],
    references: [courses.courseId],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
