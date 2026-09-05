import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  certificateRequestStatusEnum,
  certificateRequestItemStatusEnum,
} from "./enums";
import { courseIntakes } from "./course-intakes";
import { courses } from "./courses";
import { enrollments } from "./enrollments";
import { users } from "./users";
import { certificates } from "./certificates";

/**
 * Batch request to print graduation certificates.
 * Flow: admin creates → Chief Instructor approves → Commandant approves → print.
 */
export const certificateRequests = pgTable(
  "certificate_requests",
  {
    id: serial("id").primaryKey(),
    requestNumber: varchar("request_number", { length: 40 }).notNull().unique(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.courseId, { onDelete: "cascade" }),
    intakeId: integer("intake_id")
      .notNull()
      .references(() => courseIntakes.intakeId, { onDelete: "cascade" }),
    status: certificateRequestStatusEnum("status").notNull().default("draft"),
    certificateCount: integer("certificate_count").notNull().default(0),
    notes: text("notes"),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    chiefInstructorApprovedBy: integer("chief_instructor_approved_by").references(
      () => users.id
    ),
    chiefInstructorApprovedAt: timestamp("chief_instructor_approved_at", {
      withTimezone: true,
    }),
    commandantApprovedBy: integer("commandant_approved_by").references(
      () => users.id
    ),
    commandantApprovedAt: timestamp("commandant_approved_at", {
      withTimezone: true,
    }),
    rejectedBy: integer("rejected_by").references(() => users.id),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    /** Which official rejected: chief_instructor | commandant */
    rejectedStage: varchar("rejected_stage", { length: 30 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_cert_req_status").on(table.status),
    index("idx_cert_req_intake").on(table.intakeId),
    index("idx_cert_req_created_by").on(table.createdBy),
  ]
);

export const certificateRequestItems = pgTable(
  "certificate_request_items",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => certificateRequests.id, { onDelete: "cascade" }),
    enrollmentId: integer("enrollment_id")
      .notNull()
      .references(() => enrollments.enrollmentId, { onDelete: "cascade" }),
    studentArmyNumber: varchar("student_army_number", { length: 20 }).notNull(),
    status: certificateRequestItemStatusEnum("status")
      .notNull()
      .default("pending"),
    certificateId: integer("certificate_id").references(
      () => certificates.certificateId
    ),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_cert_req_item_unique").on(
      table.requestId,
      table.enrollmentId
    ),
    index("idx_cert_req_item_enrollment").on(table.enrollmentId),
    index("idx_cert_req_item_request").on(table.requestId),
  ]
);

export const certificateRequestsRelations = relations(
  certificateRequests,
  ({ one, many }) => ({
    course: one(courses, {
      fields: [certificateRequests.courseId],
      references: [courses.courseId],
    }),
    intake: one(courseIntakes, {
      fields: [certificateRequests.intakeId],
      references: [courseIntakes.intakeId],
    }),
    creator: one(users, {
      fields: [certificateRequests.createdBy],
      references: [users.id],
    }),
    items: many(certificateRequestItems),
  })
);

export const certificateRequestItemsRelations = relations(
  certificateRequestItems,
  ({ one }) => ({
    request: one(certificateRequests, {
      fields: [certificateRequestItems.requestId],
      references: [certificateRequests.id],
    }),
    enrollment: one(enrollments, {
      fields: [certificateRequestItems.enrollmentId],
      references: [enrollments.enrollmentId],
    }),
  })
);

export type CertificateRequest = typeof certificateRequests.$inferSelect;
export type CertificateRequestItem =
  typeof certificateRequestItems.$inferSelect;
