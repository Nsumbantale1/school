import { redirect } from "next/navigation";
import { getSessionUser, type UserRole, type SessionUser } from "./index";

export type { SessionUser, UserRole };
export * from "./permissions";

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(allowed: UserRole[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!allowed.includes(user.role)) {
    redirect("/dashboard?error=unauthorized");
  }
  return user;
}
