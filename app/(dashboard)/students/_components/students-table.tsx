"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/data-table";

interface StudentRow {
  armyNumber: string;
  fullName: string;
  rank: string;
  gender: string;
  unit: string | null;
  phone: string | null;
  isActive: boolean;
}

const columns: Column<StudentRow>[] = [
  {
    key: "armyNumber",
    header: "Army Number",
    cell: (row) => <span className="font-mono text-sm">{row.armyNumber}</span>,
    sortable: true,
  },
  {
    key: "rank",
    header: "Rank",
    cell: (row) => row.rank,
    sortable: true,
  },
  {
    key: "fullName",
    header: "Full Name",
    cell: (row) => row.fullName,
    sortable: true,
  },
  {
    key: "gender",
    header: "Gender",
    cell: (row) => <span className="capitalize">{row.gender}</span>,
  },
  {
    key: "unit",
    header: "Unit",
    cell: (row) => row.unit ?? "—",
  },
  {
    key: "phone",
    header: "Phone",
    cell: (row) => row.phone ?? "—",
  },
];

export function StudentsTable({ data }: { data: StudentRow[] }) {
  const router = useRouter();

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="fullName"
      searchPlaceholder="Search by name..."
      getRowKey={(row) => row.armyNumber}
      onRowClick={(row) => router.push(`/students/${row.armyNumber}`)}
    />
  );
}
