"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth";
import { isUserRole, type UserRole } from "@/lib/auth/types";
import { logAudit } from "@/lib/utils/audit";

type ActionResult = { success: true } | { success: false; error: string };

const USERNAME_RE = /^[a-z0-9._-]{3,50}$/;
const MIN_PASSWORD = 8;

function text(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function parseCourseId(raw: string, role: UserRole): number | null {
  if (role !== "instructor" || !raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateProfile(fd: FormData):
  | { ok: true; name: string; email: string | null; role: UserRole; assignedCourseId: number | null }
  | { ok: false; error: string } {
  const name = text(fd, "name");
  const email = text(fd, "email") || null;
  const role = text(fd, "role");
  if (name.length < 2 || name.length > 100) {
    return { ok: false, error: "Full name must be 2–100 characters." };
  }
  if (email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!isUserRole(role)) return { ok: false, error: "Choose a valid role." };
  return {
    ok: true,
    name,
    email,
    role,
    assignedCourseId: parseCourseId(text(fd, "assignedCourseId"), role),
  };
}

export async function createUser(fd: FormData): Promise<ActionResult> {
  const actor = await requireRole(["admin"]);

  const username = text(fd, "username").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!USERNAME_RE.test(username)) {
    return {
      success: false,
      error: "Username: 3–50 characters, letters, numbers, dot, dash or underscore.",
    };
  }
  if (password.length < MIN_PASSWORD) {
    return { success: false, error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }
  const profile = validateProfile(fd);
  if (!profile.ok) return { success: false, error: profile.error };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existing) return { success: false, error: "That username is already taken." };

  const [created] = await db
    .insert(users)
    .values({
      username,
      passwordHash: await hashPassword(password),
      name: profile.name,
      email: profile.email,
      role: profile.role,
      assignedCourseId: profile.assignedCourseId,
      isActive: true,
    })
    .returning({ id: users.id });

  await logAudit({
    user: actor,
    action: "create",
    tableName: "users",
    recordId: String(created.id),
    newValues: {
      username,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      assignedCourseId: profile.assignedCourseId,
    },
  });

  revalidatePath("/users");
  return { success: true };
}

export async function updateUser(fd: FormData): Promise<ActionResult> {
  const actor = await requireRole(["admin"]);

  const id = Number(fd.get("id"));
  if (!Number.isInteger(id)) return { success: false, error: "Invalid user." };
  const profile = validateProfile(fd);
  if (!profile.ok) return { success: false, error: profile.error };

  const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!before) return { success: false, error: "User not found." };

  if (id === actor.userId && profile.role !== "admin") {
    return { success: false, error: "You cannot remove your own admin role." };
  }
  if (before.role === "admin" && profile.role !== "admin" && (await isLastActiveAdmin(id))) {
    return { success: false, error: "At least one active admin must remain." };
  }

  await db
    .update(users)
    .set({
      name: profile.name,
      email: profile.email,
      role: profile.role,
      assignedCourseId: profile.assignedCourseId,
    })
    .where(eq(users.id, id));

  await logAudit({
    user: actor,
    action: "update",
    tableName: "users",
    recordId: String(id),
    oldValues: {
      name: before.name,
      email: before.email,
      role: before.role,
      assignedCourseId: before.assignedCourseId,
    },
    newValues: {
      name: profile.name,
      email: profile.email,
      role: profile.role,
      assignedCourseId: profile.assignedCourseId,
    },
  });

  revalidatePath("/users");
  return { success: true };
}

export async function setUserActive(id: number, isActive: boolean): Promise<ActionResult> {
  const actor = await requireRole(["admin"]);

  if (!Number.isInteger(id)) return { success: false, error: "Invalid user." };
  if (id === actor.userId && !isActive) {
    return { success: false, error: "You cannot deactivate your own account." };
  }
  const [before] = await db
    .select({ role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!before) return { success: false, error: "User not found." };
  if (!isActive && before.role === "admin" && (await isLastActiveAdmin(id))) {
    return { success: false, error: "At least one active admin must remain." };
  }

  await db.update(users).set({ isActive }).where(eq(users.id, id));
  await logAudit({
    user: actor,
    action: "update",
    tableName: "users",
    recordId: String(id),
    oldValues: { isActive: before.isActive },
    newValues: { isActive },
  });

  revalidatePath("/users");
  return { success: true };
}

export async function resetUserPassword(fd: FormData): Promise<ActionResult> {
  const actor = await requireRole(["admin"]);

  const id = Number(fd.get("id"));
  const password = String(fd.get("password") ?? "");
  if (!Number.isInteger(id)) return { success: false, error: "Invalid user." };
  if (password.length < MIN_PASSWORD) {
    return { success: false, error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }

  const updated = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (updated.length === 0) return { success: false, error: "User not found." };

  await logAudit({
    user: actor,
    action: "update",
    tableName: "users",
    recordId: String(id),
    newValues: { password: "reset" },
  });

  return { success: true };
}

async function isLastActiveAdmin(excludingId: number): Promise<boolean> {
  const others = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true), ne(users.id, excludingId)))
    .limit(1);
  return others.length === 0;
}
