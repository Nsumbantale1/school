import { pgEnum } from "drizzle-orm/pg-core";

// Personnel/Student category
export const personnelCategoryEnum = pgEnum("personnel_category", [
  "officer",
  "enlisted",
]);

// Gender types
export const genderTypeEnum = pgEnum("gender_type", ["male", "female"]);

// Enrollment status
export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "enrolled",
  "in_progress",
  "completed",
  "failed",
  "incomplete",
  "indiscipline",
  "withdrawn",
]);

// User roles - changed data_entry to instructor
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "instructor",
  "viewer",
  "chief_instructor",
  "commandant",
]);

// Grades for results
export const gradeEnum = pgEnum("grade", ["A", "B", "C", "D", "F"]);
export type Grade = (typeof gradeEnum.enumValues)[number];

// Audit log actions
export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
]);

// School officials on certificates (Chief Instructor, Commandant, etc.)
export const officialRoleEnum = pgEnum("official_role", [
  "chief_instructor",
  "commandant",
]);

/** Dual-approval certificate print requests */
export const certificateRequestStatusEnum = pgEnum(
  "certificate_request_status",
  [
    "draft",
    "pending_chief_instructor",
    "pending_commandant",
    "approved",
    "rejected",
    "cancelled",
    "issued",
    "partially_issued",
  ]
);

export const certificateRequestItemStatusEnum = pgEnum(
  "certificate_request_item_status",
  ["pending", "issued", "removed"]
);

export const noticeCategoryEnum = pgEnum("notice_category", [
  "general",
  "schedule",
  "safety",
  "exam",
  "admin",
]);

export const noticePriorityEnum = pgEnum("notice_priority", [
  "normal",
  "important",
  "urgent",
]);

export const exerciseTypeEnum = pgEnum("exercise_type", [
  "theory",
  "practical",
  "firing",
  "pt",
  "field",
  "assessment",
  "drill",
  "other",
]);
