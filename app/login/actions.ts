"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { logLoginAttempt } from "@/lib/utils/login-audit";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  getClientKey,
  recordLoginFailure,
} from "@/lib/utils/login-rate-limit";

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  const username = (formData.get("username") as string)?.trim() || "";
  const password = formData.get("password") as string;
  const ip = await clientIp();
  const rateKey = getClientKey(ip, username || "(empty)");

  const limit = checkLoginRateLimit(rateKey);
  if (!limit.allowed) {
    await logLoginAttempt({
      username: username || "(empty)",
      success: false,
      failureReason: "Rate limited",
    });
    return {
      error: `Too many failed attempts. Try again in ${limit.retryAfterSec} seconds.`,
    };
  }

  if (!username || !password) {
    recordLoginFailure(rateKey);
    await logLoginAttempt({
      username: username || "(empty)",
      success: false,
      failureReason: "Missing username or password",
    });
    return { error: "Username and password are required." };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user || !user.isActive) {
    recordLoginFailure(rateKey);
    await logLoginAttempt({
      username,
      success: false,
      failureReason: !user ? "Unknown user" : "Inactive account",
    });
    return { error: "Invalid username or password." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    recordLoginFailure(rateKey);
    await logLoginAttempt({
      userId: user.id,
      username,
      success: false,
      failureReason: "Wrong password",
    });
    return { error: "Invalid username or password." };
  }

  clearLoginFailures(rateKey);

  await db
    .update(users)
    .set({ lastLogin: new Date() })
    .where(eq(users.id, user.id));

  await logLoginAttempt({
    userId: user.id,
    username,
    success: true,
  });

  await setSessionCookie({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    assignedCourseId: user.assignedCourseId ?? null,
  });

  redirect("/dashboard");
}
