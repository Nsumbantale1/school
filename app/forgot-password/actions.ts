"use server";

import { headers } from "next/headers";
import {
  completePasswordReset,
  requestPasswordReset,
  RESET_REQUEST_MESSAGE,
} from "@/lib/utils/password-reset";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function requestPasswordResetAction(
  _prev: { message?: string; error?: string } | null,
  formData: FormData
) {
  const identifier = String(formData.get("identifier") ?? "");
  if (!identifier.trim()) return { error: "Enter your username or email." };
  try {
    await requestPasswordReset(identifier, await clientIp());
  } catch (error) {
    console.error("Password reset request failed:", error);
  }
  return { message: RESET_REQUEST_MESSAGE };
}

export async function completePasswordResetAction(
  _prev: { done?: boolean; error?: string } | null,
  formData: FormData
) {
  const result = await completePasswordReset(
    String(formData.get("token") ?? ""),
    String(formData.get("password") ?? ""),
    String(formData.get("confirm") ?? "")
  );
  return result.success ? { done: true } : { error: result.error };
}
