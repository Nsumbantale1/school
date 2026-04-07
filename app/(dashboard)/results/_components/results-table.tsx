"use client";

import { useRouter } from "next/navigation";
import { GradeBadge } from "@/components/grade-badge";
import { DataTable, type Column } from "@/components/data-table";

interface ResultRow {
  resultId: number;
  studentArmyNumber: string;
  fullName: string;
  rank: string;
  courseCode: string;
  intakeNumber: string;
  subjectName: string;
  marksObtained: string;
  maxMarks: string;
  grade: string | null;
  enteredByName: string | null;
}

const columns: Column<ResultRow>[] = [
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
        <p className="text-sm text-muted-foreground">{row.intakeNumber}</p>
      </div>
    ),
  },
  {
    key: "subjectName",
    header: "Subject",
    cell: (row) => row.subjectName,
    sortable: true,
  },
  {
    key: "marksObtained",
    header: "Marks",
    cell: (row) => `${parseFloat(row.marksObtained).toFixed(1)} / ${parseFloat(row.maxMarks).toFixed(0)}`,
  },
  {
    key: "percentage",
    header: "Percentage",
    cell: (row) => {
      const percentage =
        (parseFloat(row.marksObtained) / parseFloat(row.maxMarks)) * 100;
      return `${percentage.toFixed(1)}%`;
    },
  },
  {
    key: "grade",
    header: "Grade",
    cell: (row) => <GradeBadge grade={row.grade as any} />,
  },
  {
    key: "enteredByName",
    header: "Entered By",
    cell: (row) => row.enteredByName ?? "—",
  },
];

export function ResultsTable({ data }: { data: ResultRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="fullName"
      searchPlaceholder="Search by student name..."
      getRowKey={(row) => row.resultId}
    />
  );
}
