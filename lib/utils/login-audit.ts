import { db } from "@/lib/db";
import { loginLogs } from "@/lib/db/schema";
import { headers } from "next/headers";

export async function logLoginAttempt(opts: {
  userId?: number | null;
  username: string;
  success: boolean;
  failureReason?: string | null;
}): Promise<void> {
  try {
    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    await db.insert(loginLogs).values({
      userId: opts.userId ?? null,
      username: opts.username,
      success: opts.success,
      failureReason: opts.failureReason ?? null,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("Failed to log login attempt:", error);
  }
}
