import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { StudentForm } from "../../_components/student-form";
import { requireRole } from "@/lib/auth/guards";
import { decodeArmyNumber } from "@/lib/utils";

interface PageProps {
  params: Promise<{ army_number: string }>;
}

export default async function EditStudentPage({ params }: PageProps) {
  await requireRole(["admin"]);
  const { army_number: rawArmyNumber } = await params;
  const army_number = decodeArmyNumber(rawArmyNumber);

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.armyNumber, army_number))
    .limit(1);

  if (!student) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Student"
        description={`Editing ${student.rank} ${student.fullName}`}
      >
        <BackButton fallbackHref={`/students/${encodeURIComponent(army_number)}`} />
      </PageHeader>
      <StudentForm
        initialData={{
          armyNumber: student.armyNumber,
          fullName: student.fullName,
          rank: student.rank,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
          unit: student.unit,
          phone: student.phone,
          email: student.email,
          notes: student.notes,
        }}
      />
    </div>
  );
}
