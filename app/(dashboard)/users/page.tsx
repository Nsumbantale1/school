export const dynamic = "force-dynamic";

import { asc, eq } from "drizzle-orm";
import { ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { db } from "@/lib/db";
import { courses, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { UsersManager } from "./_components/users-manager";

export default async function UsersPage() {
  const me = await requireRole(["admin"]);

  const [rows, courseRows] = await Promise.all([
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
  ]);

  const active = rows.filter((u) => u.isActive).length;
  const admins = rows.filter((u) => u.role === "admin" && u.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage system accounts, roles and access"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Accounts" value={rows.length} icon={Users} tone="primary" />
        <StatCard title="Active" value={active} icon={UserCheck} tone="olive" />
        <StatCard title="Inactive" value={rows.length - active} icon={UserX} tone="highlight" />
        <StatCard title="Administrators" value={admins} icon={ShieldCheck} tone="slate" />
      </div>

      <UsersManager
        currentUserId={me.userId}
        courses={courseRows}
        users={rows.map((u) => ({
          ...u,
          lastLogin: u.lastLogin?.toISOString() ?? null,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
