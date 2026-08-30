export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { BackButton } from "@/components/back-button";
import { FileText, Pencil } from "lucide-react";
import { decodeArmyNumber, studentPath } from "@/lib/utils";
import { getStudentServiceRecord } from "@/lib/utils/student-service-record";
import { getSessionUser } from "@/lib/auth";
import { canManageStudents } from "@/lib/auth/guards";
import { ServiceRecordView } from "../_components/service-record-view";
import { DownloadSsrButton } from "../_components/download-ssr-button";

interface PageProps {
  params: Promise<{ army_number: string }>;
}

export default async function StudentServiceRecordPage({ params }: PageProps) {
  const { army_number: rawArmyNumber } = await params;
  const army_number = decodeArmyNumber(rawArmyNumber);
  const user = await getSessionUser();

  const record = await getStudentServiceRecord(army_number);
  if (!record) notFound();

  const printTitle = `STR — ${record.student.rank} ${record.student.fullName} (${record.student.armyNumber})`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Training Record"
        description={`${record.student.rank} ${record.student.fullName} · ${record.student.armyNumber}`}
      >
        <DownloadSsrButton record={record} />
        <PrintButton title={printTitle} />
        <Button variant="outline" asChild className="print:hidden">
          <Link href={studentPath(army_number)}>
            <FileText className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </Button>
        {user && canManageStudents(user.role) && (
          <Button variant="outline" asChild className="print:hidden">
            <Link href={studentPath(army_number, "/edit")}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
        <BackButton
          fallbackHref={studentPath(army_number)}
          className="print:hidden"
        />
      </PageHeader>

      <ServiceRecordView record={record} />
    </div>
  );
}
