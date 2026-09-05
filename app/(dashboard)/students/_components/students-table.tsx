"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { studentPath } from "@/lib/utils";

interface StudentRow {
  armyNumber: string;
  fullName: string;
  rank: string;
  gender: string;
  unit: string | null;
  phone: string | null;
  photoPath?: string | null;
  isActive: boolean;
  enrollments: { courseId: number; intakeId: number }[];
}

interface CourseOption {
  courseId: number;
  courseCode: string;
  courseName: string;
}

interface IntakeOption {
  intakeId: number;
  intakeNumber: string;
  courseId: number;
}

const ALL = "__all__";

const columns: Column<StudentRow>[] = [
  {
    key: "photoPath",
    header: "",
    cell: (row) =>
      row.photoPath ? (
        <img
          src={row.photoPath}
          alt=""
          className="h-9 w-8 rounded object-cover border"
        />
      ) : (
        <div className="h-9 w-8 rounded border bg-muted" />
      ),
  },
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

export function StudentsTable({
  data,
  courses,
  intakes,
}: {
  data: StudentRow[];
  courses: CourseOption[];
  intakes: IntakeOption[];
}) {
  const router = useRouter();
  const [gender, setGender] = React.useState<string>(ALL);
  const [rank, setRank] = React.useState<string>(ALL);
  const [unit, setUnit] = React.useState<string>(ALL);
  const [courseId, setCourseId] = React.useState<string>(ALL);
  const [intakeId, setIntakeId] = React.useState<string>(ALL);

  const intakesForCourse = React.useMemo(
    () =>
      courseId === ALL
        ? intakes
        : intakes.filter((i) => i.courseId === Number(courseId)),
    [intakes, courseId],
  );

  React.useEffect(() => {
    if (
      intakeId !== ALL &&
      !intakesForCourse.some((i) => String(i.intakeId) === intakeId)
    ) {
      setIntakeId(ALL);
    }
  }, [intakesForCourse, intakeId]);

  const ranks = React.useMemo(
    () => Array.from(new Set(data.map((d) => d.rank).filter(Boolean))).sort(),
    [data],
  );
  const units = React.useMemo(
    () =>
      Array.from(
        new Set(data.map((d) => d.unit).filter((u): u is string => !!u)),
      ).sort(),
    [data],
  );
  const genders = React.useMemo(
    () => Array.from(new Set(data.map((d) => d.gender).filter(Boolean))).sort(),
    [data],
  );

  const filtered = React.useMemo(
    () =>
      data.filter((r) => {
        if (gender !== ALL && r.gender !== gender) return false;
        if (rank !== ALL && r.rank !== rank) return false;
        if (unit !== ALL && r.unit !== unit) return false;
        if (courseId !== ALL) {
          const cid = Number(courseId);
          if (!r.enrollments.some((e) => e.courseId === cid)) return false;
        }
        if (intakeId !== ALL) {
          const iid = Number(intakeId);
          if (!r.enrollments.some((e) => e.intakeId === iid)) return false;
        }
        return true;
      }),
    [data, gender, rank, unit, courseId, intakeId],
  );

  const hasFilter =
    gender !== ALL ||
    rank !== ALL ||
    unit !== ALL ||
    courseId !== ALL ||
    intakeId !== ALL;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All genders</SelectItem>
            {genders.map((g) => (
              <SelectItem key={g} value={g} className="capitalize">
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={rank} onValueChange={setRank}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Rank" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All ranks</SelectItem>
            {ranks.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All units</SelectItem>
            {units.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.courseId} value={String(c.courseId)}>
                {c.courseCode} — {c.courseName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={intakeId} onValueChange={setIntakeId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Intake" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All intakes</SelectItem>
            {intakesForCourse.map((i) => (
              <SelectItem key={i.intakeId} value={String(i.intakeId)}>
                {i.intakeNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setGender(ALL);
              setRank(ALL);
              setUnit(ALL);
              setCourseId(ALL);
              setIntakeId(ALL);
            }}
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchKey="fullName"
        searchKeys={["fullName", "armyNumber", "unit", "rank"]}
        searchPlaceholder="Search name, army number, rank, or unit (e.g. SOFA)..."
        getRowKey={(row) => row.armyNumber}
        onRowClick={(row) => router.push(studentPath(row.armyNumber))}
      />
    </div>
  );
}
