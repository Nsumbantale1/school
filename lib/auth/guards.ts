import { redirect } from "next/navigation";
import { getSessionUser, type UserRole, type SessionUser } from "./index";

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(allowed: UserRole[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!allowed.includes(user.role)) {
    throw new Error("Unauthorized: insufficient permissions");
  }
  return user;
}

// --- Feature-specific permission helpers ---

/** Students: admin only can create/edit */
export function canManageStudents(role: UserRole): boolean {
  return role === "admin";
}

/** Courses: admin only */
export function canManageCourses(role: UserRole): boolean {
  return role === "admin";
}

/** Intakes: admin only */
export function canManageIntakes(role: UserRole): boolean {
  return role === "admin";
}

/** Enrollments: admin only */
export function canManageEnrollments(role: UserRole): boolean {
  return role === "admin";
}

/** Results: admin + instructor can manage */
export function canManageResults(role: UserRole): boolean {
  return role === "admin" || role === "instructor";
}

/** Users: admin only */
export function canManageUsers(role: UserRole): boolean {
  return role === "admin";
}

/** Audit Logs: admin only can view */
export function canViewAuditLogs(role: UserRole): boolean {
  return role === "admin";
}

/** Documents: admin only can manage, others can view */
export function canManageDocuments(role: UserRole): boolean {
  return role === "admin";
}

/** Export: admin + instructor can export */
export function canExport(role: UserRole): boolean {
  return role === "admin" || role === "instructor";
}

/** Check if instructor can manage results for a specific course */
export function canManageResultsForCourse(
  user: SessionUser,
  courseId: number
): boolean {
  if (user.role === "admin") return true;
  if (user.role === "instructor" && user.assignedCourseId === courseId) return true;
  return false;
}

// Legacy helpers for backward compatibility
export function canCreate(role: UserRole): boolean {
  return role === "admin";
}

export function canEdit(role: UserRole): boolean {
  return role === "admin";
}

export function canDelete(role: UserRole): boolean {
  return role === "admin";
}
