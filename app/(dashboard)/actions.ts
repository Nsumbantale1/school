"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, getSessionUser } from "@/lib/auth";
import { auditCreate } from "@/lib/utils/audit";

export async function logoutAction() {
  const user = await getSessionUser();
  if (user) {
    await auditCreate(user, "users", user.username, {
      event: "logout",
      name: user.name,
      role: user.role,
    });
  }
  await clearSessionCookie();
  redirect("/login");
}
