export const dynamic = "force-dynamic";

import { asc, eq } from "drizzle-orm";
import { ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { db } from "@/lib/db";
import { courses, users } from "@/lib/db/schema";
import { canManageUsers, requireRole, VIEW_ALL_ROLES } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { listOpenPasswordResets } from "@/lib/utils/password-reset";
import { UsersManager } from "./_components/users-manager";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const me = await requireRole(VIEW_ALL_ROLES);
  const readOnly = !canManageUsers(me.role);
  const { reset } = await searchParams;

  const [rows, courseRows, resetRequests] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        assignedCourseId: users.assignedCourseId,
        assignedCourseCode: courses.courseCode,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(courses, eq(users.assignedCourseId, courses.courseId))
      .orderBy(asc(users.name)),
    db
      .select({ id: courses.courseId, code: courses.courseCode, name: courses.courseName })
      .from(courses)
      .where(eq(courses.isActive, true))
      .orderBy(asc(courses.courseCode)),
    listOpenPasswordResets().catch(() => []),
  ]);

  const active = rows.filter((u) => u.isActive).length;
  const admins = rows.filter((u) => u.role === "admin" && u.isActive).length;
  const initialResetUserId = reset ? Number(reset) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={
          readOnly
            ? "System accounts, roles and access (view only)"
            : "Manage system accounts, roles and access"
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Accounts" value={rows.length} icon={Users} tone="primary" />
        <StatCard title="Active" value={active} icon={UserCheck} tone="olive" />
        <StatCard title="Inactive" value={rows.length - active} icon={UserX} tone="highlight" />
        <StatCard title="Administrators" value={admins} icon={ShieldCheck} tone="slate" />
      </div>

      <UsersManager
        currentUserId={me.userId}
        readOnly={readOnly}
        courses={courseRows}
        resetRequests={resetRequests.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
        initialResetUserId={
          initialResetUserId && Number.isInteger(initialResetUserId)
            ? initialResetUserId
            : undefined
        }
        users={rows.map((u) => ({
          ...u,
          lastLogin: u.lastLogin?.toISOString() ?? null,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
