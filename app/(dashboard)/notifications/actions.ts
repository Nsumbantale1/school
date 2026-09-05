"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/utils/notify";

export async function markOneNotificationRead(notificationId: number) {
  const user = await requireAuth();
  await markNotificationRead(notificationId, user.userId);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function markNotificationsReadAll() {
  const user = await requireAuth();
  await markAllNotificationsRead(user.userId);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function updateOfficialContactEmail(formData: FormData) {
  await requireRole(["admin"]);
  const userId = parseInt(formData.get("userId") as string, 10);
  const email = ((formData.get("email") as string) || "").trim() || null;
  if (!userId) return { success: false as const, error: "Invalid user." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false as const, error: "Invalid email address." };
  }
  await db.update(users).set({ email }).where(eq(users.id, userId));
  revalidatePath("/settings/signatures");
  revalidatePath("/certificates");
  return { success: true as const };
}
