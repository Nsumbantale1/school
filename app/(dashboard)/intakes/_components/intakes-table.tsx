"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/data-table";
import { formatIntakeLabel } from "@/lib/utils/intake-label";
import { getCourseDisplayMeta } from "@/lib/utils/course-catalog";

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
      <span className="font-semibold tracking-wide">
        {getCourseDisplayMeta(row.courseCode, row.courseName).label}
      </span>
    ),
    sortable: true,
  },
  {
    key: "intakeNumber",
    header: "Intake",
    cell: (row) => (
      <span className="font-semibold tracking-wide">
        {formatIntakeLabel({
          intakeNumber: row.intakeNumber,
          startDate: row.startDate,
          endDate: row.endDate,
          year: row.year,
        })}
      </span>
    ),
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
    cell: (row) => new Date(row.startDate).toLocaleDateString("en-GB"),
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
      searchKeys={["courseName", "courseCode", "intakeNumber", "commanderName"]}
      searchPlaceholder="Search course, intake, or commander..."
      getRowKey={(row) => row.intakeId}
      onRowClick={(row) => router.push(`/intakes/${row.intakeId}`)}
    />
  );
}
