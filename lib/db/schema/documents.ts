import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { students } from "./students";
import { enrollments } from "./enrollments";
import { users } from "./users";

export const documents = pgTable(
  "documents",
  {
    documentId: serial("document_id").primaryKey(),
    studentArmyNumber: varchar("student_army_number", { length: 20 }).references(
      () => students.armyNumber,
      { onDelete: "cascade" }
    ),
    enrollmentId: integer("enrollment_id").references(
      () => enrollments.enrollmentId,
      { onDelete: "cascade" }
    ),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileType: varchar("file_type", { length: 50 }).notNull(), // e.g., "pdf", "jpg", "png"
    fileSize: integer("file_size").notNull(), // in bytes
    filePath: varchar("file_path", { length: 500 }).notNull(),
    description: text("description"),
    uploadedBy: integer("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_doc_student").on(table.studentArmyNumber),
    index("idx_doc_enrollment").on(table.enrollmentId),
    index("idx_doc_uploaded_by").on(table.uploadedBy),
    index("idx_doc_file_type").on(table.fileType),
  ]
);

export const documentsRelations = relations(documents, ({ one }) => ({
  student: one(students, {
    fields: [documents.studentArmyNumber],
    references: [students.armyNumber],
  }),
  enrollment: one(enrollments, {
    fields: [documents.enrollmentId],
    references: [enrollments.enrollmentId],
  }),
  uploadedByUser: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
