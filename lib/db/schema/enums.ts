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
  "withdrawn",
]);

// User roles - changed data_entry to instructor
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "instructor",
  "viewer",
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
