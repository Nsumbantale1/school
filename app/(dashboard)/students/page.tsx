export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StudentsTable } from "./_components/students-table";
import { PrintButton } from "@/components/print-button";
import { Plus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canManageStudents } from "@/lib/auth/guards";

export default async function StudentsPage() {
  const user = await getSessionUser();
  const data = await db
    .select()
    .from(students)
    .where(eq(students.isActive, true))
    .orderBy(students.fullName);

  return (
    <div className="space-y-6">
      <PageHeader title="Students" description="Manage student records">
        <PrintButton title="Student List — School of Field Artillery" />
        {user && canManageStudents(user.role) && (
          <Button asChild>
            <Link href="/students/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Link>
          </Button>
        )}
      </PageHeader>
      <StudentsTable data={data} />
    </div>
  );
}
