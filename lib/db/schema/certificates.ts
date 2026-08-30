import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  text,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { officialRoleEnum } from "./enums";
import { enrollments } from "./enrollments";
import { users } from "./users";

/** Scanned/uploaded signatures for certificate signatories. */
export const officialSignatures = pgTable(
  "official_signatures",
  {
    id: serial("id").primaryKey(),
    role: officialRoleEnum("role").notNull(),
    fullName: varchar("full_name", { length: 100 }),
    rankTitle: varchar("rank_title", { length: 50 }),
    /** Public path e.g. /signatures/chief-instructor-123.png */
    signatureImagePath: varchar("signature_image_path", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    effectiveFrom: date("effective_from"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_official_role").on(table.role),
    index("idx_official_active").on(table.isActive),
  ]
);

export const certificates = pgTable(
  "certificates",
  {
    certificateId: serial("certificate_id").primaryKey(),
    enrollmentId: integer("enrollment_id")
      .notNull()
      .references(() => enrollments.enrollmentId, { onDelete: "cascade" }),
    certificateNumber: varchar("certificate_number", { length: 60 })
      .notNull()
      .unique(),
    chiefInstructorName: varchar("chief_instructor_name", { length: 100 }),
    chiefInstructorRank: varchar("chief_instructor_rank", { length: 50 }),
    chiefInstructorSignaturePath: varchar("chief_instructor_signature_path", {
      length: 255,
    }),
    commandantName: varchar("commandant_name", { length: 100 }),
    commandantRank: varchar("commandant_rank", { length: 50 }),
    commandantSignaturePath: varchar("commandant_signature_path", {
      length: 255,
    }),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    issuedBy: integer("issued_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("idx_certificate_enrollment").on(table.enrollmentId),
    index("idx_certificate_number").on(table.certificateNumber),
  ]
);

export const officialSignaturesRelations = relations(
  officialSignatures,
  () => ({})
);

export const certificatesRelations = relations(certificates, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [certificates.enrollmentId],
    references: [enrollments.enrollmentId],
  }),
  issuer: one(users, {
    fields: [certificates.issuedBy],
    references: [users.id],
  }),
}));

export type OfficialSignature = typeof officialSignatures.$inferSelect;
export type NewOfficialSignature = typeof officialSignatures.$inferInsert;
export type Certificate = typeof certificates.$inferSelect;
