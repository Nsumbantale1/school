"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/data-table";

interface CourseRow {
  courseId: number;
  courseCode: string;
  courseName: string;
  durationWeeks: number;
  passingMark: number;
  description: string | null;
  intakeCount?: number;
}

const columns: Column<CourseRow>[] = [
  {
    key: "courseCode",
    header: "Code",
    cell: (row) => <span className="font-mono text-sm">{row.courseCode}</span>,
    sortable: true,
  },
  {
    key: "courseName",
    header: "Course Name",
    cell: (row) => row.courseName,
    sortable: true,
  },
  {
    key: "durationWeeks",
    header: "Duration",
    cell: (row) => `${row.durationWeeks} weeks`,
  },
  {
    key: "passingMark",
    header: "Passing Mark",
    cell: (row) => `${row.passingMark}%`,
  },
  {
    key: "intakeCount",
    header: "Intakes",
    cell: (row) => (
      <Badge variant="outline">{row.intakeCount ?? 0}</Badge>
    ),
  },
];

export function CoursesTable({ data }: { data: CourseRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="courseName"
      searchPlaceholder="Search courses..."
      getRowKey={(row) => row.courseId}
      onRowClick={(row) => router.push(`/courses/${row.courseId}`)}
    />
  );
}
