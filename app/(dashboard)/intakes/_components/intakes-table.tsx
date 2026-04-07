"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/data-table";

interface IntakeRow {
  intakeId: number;
  intakeNumber: string;
  year: number;
  courseCode: string;
  courseName: string;
  commanderName: string | null;
  coordinatorName: string | null;
  startDate: string;
  endDate: string | null;
  enrollmentCount?: number;
}

const columns: Column<IntakeRow>[] = [
  {
    key: "courseCode",
    header: "Course",
    cell: (row) => (
      <div>
        <span className="font-mono text-sm">{row.courseCode}</span>
        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
          {row.courseName}
        </p>
      </div>
    ),
    sortable: true,
  },
  {
    key: "intakeNumber",
    header: "Intake",
    cell: (row) => row.intakeNumber,
    sortable: true,
  },
  {
    key: "year",
    header: "Year",
    cell: (row) => row.year,
    sortable: true,
  },
  {
    key: "commanderName",
    header: "Commander",
    cell: (row) => row.commanderName ?? "—",
  },
  {
    key: "startDate",
    header: "Start Date",
    cell: (row) => new Date(row.startDate).toLocaleDateString(),
    sortable: true,
  },
  {
    key: "enrollmentCount",
    header: "Students",
    cell: (row) => <Badge variant="outline">{row.enrollmentCount ?? 0}</Badge>,
  },
];

export function IntakesTable({ data }: { data: IntakeRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="courseName"
      searchPlaceholder="Search by course..."
      getRowKey={(row) => row.intakeId}
      onRowClick={(row) => router.push(`/intakes/${row.intakeId}`)}
    />
  );
}
