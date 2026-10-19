import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResetRequests, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "./audit";
import { appBaseUrl, isEmailConfigured, notifyUsersByRole, sendEmail } from "./notify";

export const MIN_PASSWORD_LENGTH = 8;
const LINK_TTL_MS = 30 * 60 * 1000;
const MAX_PER_USER_PER_HOUR = 3;
const MAX_PER_IP_PER_HOUR = 10;

export const RESET_REQUEST_MESSAGE =
  "Request received. If the account has an email address, a reset link has been sent to it. Otherwise the system administrator has been alerted and will set a new password for you.";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * Always resolves the same way whether or not the account exists, so the form
 * cannot be used to discover usernames.
 */
export async function requestPasswordReset(identifier: string, ip: string): Promise<void> {
  const key = identifier.trim().toLowerCase();
  if (!key || key.length > 120) return;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [fromIp] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(passwordResetRequests)
    .where(
      and(eq(passwordResetRequests.requestedIp, ip), gte(passwordResetRequests.createdAt, hourAgo))
    );
  if (Number(fromIp?.n ?? 0) >= MAX_PER_IP_PER_HOUR) return;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        sql`(lower(${users.username}) = ${key} or lower(${users.email}) = ${key})`
      )
    )
    .limit(1);
  if (!user) return;

  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(passwordResetRequests)
    .where(
      and(eq(passwordResetRequests.userId, user.id), gte(passwordResetRequests.createdAt, hourAgo))
    );
  if (Number(recent?.n ?? 0) >= MAX_PER_USER_PER_HOUR) return;

  const canEmail = Boolean(user.email) && isEmailConfigured();
  const token = canEmail ? randomBytes(32).toString("base64url") : null;

  await db.insert(passwordResetRequests).values({
    userId: user.id,
    tokenHash: token ? sha256(token) : null,
    expiresAt: token ? new Date(Date.now() + LINK_TTL_MS) : null,
    requestedIp: ip.slice(0, 64),
  });

  if (token && user.email) {
    const link = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your password — School of Field Artillery",
      text: [
        `Hello ${user.name},`,
        "",
        "Someone asked to reset the password for your account.",
        `Open this link within 30 minutes to choose a new password:`,
        link,
        "",
        "If you did not ask for this, ignore this email; your password will not change.",
      ].join("\n"),
    }).catch((error) => console.warn("Password reset email failed:", error));
  }

  await notifyUsersByRole({
    roles: ["admin"],
    title: `Password reset requested — ${user.name}`,
    body: canEmail
      ? `${user.name} (${user.username}) asked to reset their password; a link was emailed to them.`
      : `${user.name} (${user.username}) forgot their password. Open Users and set a new one.`,
    href: `/users?reset=${user.id}`,
    kind: "password_reset",
  }).catch((error) => console.warn("Password reset notification failed:", error));

  await logAudit({
    user: null,
    action: "create",
    tableName: "password_reset_requests",
    recordId: String(user.id),
    newValues: { username: user.username, via: canEmail ? "email link" : "admin" },
  });
}

async function findUsableToken(token: string) {
  if (!token || token.length > 200) return null;
  const [row] = await db
    .select({
      id: passwordResetRequests.id,
      userId: passwordResetRequests.userId,
      name: users.name,
      username: users.username,
    })
    .from(passwordResetRequests)
    .innerJoin(users, eq(passwordResetRequests.userId, users.id))
    .where(
      and(
        eq(passwordResetRequests.tokenHash, sha256(token)),
        eq(passwordResetRequests.status, "open"),
        gt(passwordResetRequests.expiresAt, new Date()),
        eq(users.isActive, true)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function isResetTokenValid(token: string) {
  return (await findUsableToken(token)) !== null;
}

export async function completePasswordReset(
  token: string,
  password: string,
  confirm: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) return { success: false, error: "The two passwords do not match." };

  const row = await findUsableToken(token);
  if (!row) {
    return { success: false, error: "This link is invalid or has expired. Ask for a new one." };
  }

  const claimed = await db
    .update(passwordResetRequests)
    .set({ status: "used", resolvedAt: new Date() })
    .where(and(eq(passwordResetRequests.id, row.id), eq(passwordResetRequests.status, "open")))
    .returning({ id: passwordResetRequests.id });
  if (claimed.length === 0) {
    return { success: false, error: "This link has already been used." };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, row.userId));
  await resolvePasswordResets(row.userId, null);

  await logAudit({
    user: null,
    action: "update",
    tableName: "users",
    recordId: String(row.userId),
    newValues: { password: "reset via emailed link", username: row.username },
  });

  return { success: true };
}

/** Closes every open request for this user, e.g. after the admin sets a new password. */
export async function resolvePasswordResets(userId: number, resolvedBy: number | null) {
  await db
    .update(passwordResetRequests)
    .set({ status: "resolved", resolvedBy, resolvedAt: new Date() })
    .where(and(eq(passwordResetRequests.userId, userId), eq(passwordResetRequests.status, "open")));
}

/** One line per user still waiting for the admin to set a new password. */
export async function listOpenPasswordResets() {
  const rows = await db
    .select({
      userId: passwordResetRequests.userId,
      createdAt: passwordResetRequests.createdAt,
      name: users.name,
      username: users.username,
      role: users.role,
    })
    .from(passwordResetRequests)
    .innerJoin(users, eq(passwordResetRequests.userId, users.id))
    .where(eq(passwordResetRequests.status, "open"))
    .orderBy(desc(passwordResetRequests.createdAt))
    .limit(50);

  const seen = new Set<number>();
  return rows.filter((r) => (seen.has(r.userId) ? false : (seen.add(r.userId), true)));
}
