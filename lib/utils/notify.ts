import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { appNotifications, users } from "@/lib/db/schema";
import type { UserRole } from "@/lib/auth/types";

function appBaseUrl(): string {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

async function sendEmailSmtp(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ sent: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !from) {
    return { sent: false, error: "SMTP not configured" };
  }

  try {
    // Dynamic import so the app runs without nodemailer until SMTP is used
    const nodemailer = await import("nodemailer");
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    });
    return { sent: true };
  } catch (error) {
    console.error("SMTP send failed:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "SMTP error",
    };
  }
}

export async function notifyUsersByRole(opts: {
  roles: UserRole[];
  title: string;
  body: string;
  href: string;
  kind?: string;
}) {
  const recipients = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(
      and(eq(users.isActive, true), inArray(users.role, opts.roles))
    );

  if (recipients.length === 0) return { notified: 0, emailed: 0 };

  await db.insert(appNotifications).values(
    recipients.map((r) => ({
      userId: r.id,
      title: opts.title,
      body: opts.body,
      href: opts.href,
      kind: opts.kind ?? "certificate",
    }))
  );

  const link = `${appBaseUrl()}${opts.href}`;
  let emailed = 0;
  for (const r of recipients) {
    if (!r.email) continue;
    const result = await sendEmailSmtp({
      to: r.email,
      subject: `[SOFA] ${opts.title}`,
      text: `${opts.body}\n\nOpen and act here:\n${link}\n\n— School of Field Artillery`,
    });
    if (result.sent) emailed += 1;
  }

  return { notified: recipients.length, emailed };
}

export async function notifyCertificatePendingChiefInstructor(opts: {
  requestId: number;
  requestNumber: string;
  courseLabel: string;
  certificateCount: number;
}) {
  return notifyUsersByRole({
    roles: ["chief_instructor"],
    title: `Approve certificates — ${opts.requestNumber}`,
    body: `${opts.certificateCount} certificate(s) requested for ${opts.courseLabel}. Please approve or reject as Chief Instructor.`,
    href: `/certificates/${opts.requestId}`,
    kind: "certificate_approval",
  });
}

export async function notifyCertificatePendingCommandant(opts: {
  requestId: number;
  requestNumber: string;
  courseLabel: string;
  certificateCount: number;
}) {
  return notifyUsersByRole({
    roles: ["commandant"],
    title: `Commandant approval — ${opts.requestNumber}`,
    body: `Chief Instructor approved. ${opts.certificateCount} certificate(s) for ${opts.courseLabel} await your approval to print.`,
    href: `/certificates/${opts.requestId}`,
    kind: "certificate_approval",
  });
}

export async function notifyCertificateFullyApproved(opts: {
  requestId: number;
  requestNumber: string;
  courseLabel: string;
  certificateCount: number;
}) {
  return notifyUsersByRole({
    roles: ["admin"],
    title: `Ready to print — ${opts.requestNumber}`,
    body: `Both officials approved. ${opts.certificateCount} certificate(s) for ${opts.courseLabel} are ready to print.`,
    href: `/certificates/${opts.requestId}`,
    kind: "certificate_ready",
  });
}

export async function getUnreadNotifications(userId: number, limit = 20) {
  return db
    .select()
    .from(appNotifications)
    .where(
      and(eq(appNotifications.userId, userId), eq(appNotifications.isRead, false))
    )
    .orderBy(desc(appNotifications.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(userId: number) {
  const rows = await db
    .select({ id: appNotifications.id })
    .from(appNotifications)
    .where(
      and(eq(appNotifications.userId, userId), eq(appNotifications.isRead, false))
    );
  return rows.length;
}

export async function markNotificationRead(notificationId: number, userId: number) {
  await db
    .update(appNotifications)
    .set({ isRead: true })
    .where(
      and(
        eq(appNotifications.id, notificationId),
        eq(appNotifications.userId, userId)
      )
    );
}

export async function markAllNotificationsRead(userId: number) {
  await db
    .update(appNotifications)
    .set({ isRead: true })
    .where(
      and(eq(appNotifications.userId, userId), eq(appNotifications.isRead, false))
    );
}
