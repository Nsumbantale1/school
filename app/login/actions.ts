"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "Username and password are required." };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user || !user.isActive) {
    return { error: "Invalid username or password." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid username or password." };
  }

  // Update last login
  await db
    .update(users)
    .set({ lastLogin: new Date() })
    .where(eq(users.id, user.id));

  await setSessionCookie({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });

  redirect("/dashboard");
}
