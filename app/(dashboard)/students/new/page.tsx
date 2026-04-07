import { PageHeader } from "@/components/page-header";
import { StudentForm } from "../_components/student-form";
import { requireRole } from "@/lib/auth/guards";

export default async function NewStudentPage() {
  await requireRole(["admin"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Student"
        description="Register a new student in the system"
      />
      <StudentForm />
    </div>
  );
}
