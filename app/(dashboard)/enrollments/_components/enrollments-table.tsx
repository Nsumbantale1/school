"use client";

import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { GradeBadge } from "@/components/grade-badge";
import { PositionBadge } from "@/components/position-badge";
import { DataTable, type Column } from "@/components/data-table";

interface EnrollmentRow {
  enrollmentId: number;
  studentArmyNumber: string;
  fullName: string;
  rank: string;
  courseCode: string;
  courseName: string;
  intakeNumber: string;
  year: number;
  status: string;
  averageMarks: string | null;
  grade: string | null;
  position: number | null;
}

const columns: Column<EnrollmentRow>[] = [
  {
    key: "studentArmyNumber",
    header: "Army No.",
    cell: (row) => <span className="font-mono text-sm">{row.studentArmyNumber}</span>,
  },
  {
    key: "fullName",
    header: "Student",
    cell: (row) => `${row.rank} ${row.fullName}`,
    sortable: true,
  },
  {
    key: "courseCode",
    header: "Course",
    cell: (row) => (
      <div>
        <span className="font-mono text-sm">{row.courseCode}</span>
        <p className="text-sm text-muted-foreground truncate max-w-[150px]">
          {row.intakeNumber}
        </p>
      </div>
    ),
  },
  {
    key: "year",
    header: "Year",
    cell: (row) => row.year,
    sortable: true,
  },
  {
    key: "averageMarks",
    header: "Average",
    cell: (row) =>
      row.averageMarks ? `${parseFloat(row.averageMarks).toFixed(1)}%` : "—",
  },
  {
    key: "grade",
    header: "Grade",
    cell: (row) => <GradeBadge grade={row.grade as any} />,
  },
  {
    key: "position",
    header: "Position",
    cell: (row) => <PositionBadge position={row.position} />,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <StatusBadge status={row.status} />,
  },
];

export function EnrollmentsTable({ data }: { data: EnrollmentRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="fullName"
      searchPlaceholder="Search by name..."
      getRowKey={(row) => row.enrollmentId}
      onRowClick={(row) => router.push(`/enrollments/${row.enrollmentId}`)}
    />
  );
}
