export type UserRole =
  | "admin"
  | "instructor"
  | "viewer"
  | "chief_instructor"
  | "commandant";

export interface SessionUser {
  userId: number;
  username: string;
  name: string;
  role: UserRole;
  assignedCourseId?: number | null;
}

export const ALL_USER_ROLES: UserRole[] = [
  "admin",
  "instructor",
  "viewer",
  "chief_instructor",
  "commandant",
];

export function isUserRole(value: string): value is UserRole {
  return (ALL_USER_ROLES as string[]).includes(value);
}
