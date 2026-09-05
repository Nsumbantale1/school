"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { GradeBadge } from "@/components/grade-badge";
import { PositionBadge } from "@/components/position-badge";
import { DataTable, type Column } from "@/components/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

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
  unit: string | null;
  averageMarks: string | null;
  grade: string | null;
  position: number | null;
}

const ALL = "__all__";

const SCORE_PRESETS: Array<{
  value: string;
  label: string;
  min?: number;
  max?: number;
  exclusiveMax?: boolean;
}> = [
  { value: ALL, label: "All scores" },
  { value: "below40", label: "Below 40%", max: 40, exclusiveMax: true },
  { value: "below50", label: "Below 50%", max: 50, exclusiveMax: true },
  { value: "below59", label: "Below 59%", max: 59, exclusiveMax: true },
  { value: "below60", label: "Below 60%", max: 60, exclusiveMax: true },
  { value: "from50", label: "50% and above", min: 50 },
  { value: "from60", label: "60% and above", min: 60 },
  { value: "from80", label: "80% and above", min: 80 },
];

const columns: Column<EnrollmentRow>[] = [
  {
    key: "studentArmyNumber",
    header: "Army No.",
    cell: (row) => (
      <span className="font-mono text-sm">{row.studentArmyNumber}</span>
    ),
  },
  {
    key: "fullName",
    header: "Student",
    cell: (row) => `${row.rank} ${row.fullName}`,
    sortable: true,
  },
  {
    key: "unit",
    header: "Unit",
    cell: (row) => row.unit ?? "—",
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
    sortable: true,
  },
  {
    key: "grade",
    header: "Grade",
    cell: (row) => <GradeBadge grade={row.grade as "A" | "B" | "C" | "D" | "F" | null} />,
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

function averageOf(row: EnrollmentRow): number | null {
  if (row.averageMarks == null || row.averageMarks === "") return null;
  const n = parseFloat(row.averageMarks);
  return Number.isFinite(n) ? n : null;
}

export function EnrollmentsTable({ data }: { data: EnrollmentRow[] }) {
  const router = useRouter();
  const [course, setCourse] = React.useState(ALL);
  const [unit, setUnit] = React.useState(ALL);
  const [grade, setGrade] = React.useState(ALL);
  const [status, setStatus] = React.useState(ALL);
  const [scorePreset, setScorePreset] = React.useState(ALL);
  const [customBelow, setCustomBelow] = React.useState("");
  const [customAbove, setCustomAbove] = React.useState("");

  const courses = React.useMemo(
    () =>
      Array.from(new Set(data.map((d) => d.courseCode).filter(Boolean))).sort(),
    [data],
  );
  const units = React.useMemo(
    () =>
      Array.from(
        new Set(data.map((d) => d.unit).filter((u): u is string => !!u)),
      ).sort(),
    [data],
  );
  const grades = React.useMemo(
    () =>
      Array.from(new Set(data.map((d) => d.grade).filter((g): g is string => !!g))).sort(),
    [data],
  );
  const statuses = React.useMemo(
    () => Array.from(new Set(data.map((d) => d.status).filter(Boolean))).sort(),
    [data],
  );

  const filtered = React.useMemo(() => {
    const below = customBelow.trim() !== "" ? parseFloat(customBelow) : null;
    const above = customAbove.trim() !== "" ? parseFloat(customAbove) : null;
    const preset = SCORE_PRESETS.find((p) => p.value === scorePreset);

    return data.filter((row) => {
      if (course !== ALL && row.courseCode !== course) return false;
      if (unit !== ALL && row.unit !== unit) return false;
      if (grade !== ALL && row.grade !== grade) return false;
      if (status !== ALL && row.status !== status) return false;

      const avg = averageOf(row);
      if (preset && preset.value !== ALL) {
        if (avg == null) return false;
        if (preset.min != null && avg < preset.min) return false;
        if (preset.max != null) {
          if (preset.exclusiveMax ? avg >= preset.max : avg > preset.max) {
            return false;
          }
        }
      }
      if (below != null && Number.isFinite(below)) {
        if (avg == null || avg >= below) return false;
      }
      if (above != null && Number.isFinite(above)) {
        if (avg == null || avg < above) return false;
      }
      return true;
    });
  }, [data, course, unit, grade, status, scorePreset, customBelow, customAbove]);

  const hasFilter =
    course !== ALL ||
    unit !== ALL ||
    grade !== ALL ||
    status !== ALL ||
    scorePreset !== ALL ||
    customBelow.trim() !== "" ||
    customAbove.trim() !== "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Select value={course} onValueChange={setCourse}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
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

        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All grades</SelectItem>
            {grades.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={scorePreset} onValueChange={setScorePreset}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Score" />
          </SelectTrigger>
          <SelectContent>
            {SCORE_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="space-y-1">
          <Label htmlFor="below-pct" className="text-xs text-muted-foreground">
            Below %
          </Label>
          <Input
            id="below-pct"
            type="number"
            min={0}
            max={100}
            step={1}
            placeholder="e.g. 59"
            value={customBelow}
            onChange={(e) => setCustomBelow(e.target.value)}
            className="w-[110px]"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="above-pct" className="text-xs text-muted-foreground">
            At least %
          </Label>
          <Input
            id="above-pct"
            type="number"
            min={0}
            max={100}
            step={1}
            placeholder="e.g. 60"
            value={customAbove}
            onChange={(e) => setCustomAbove(e.target.value)}
            className="w-[110px]"
          />
        </div>

        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-0.5"
            onClick={() => {
              setCourse(ALL);
              setUnit(ALL);
              setGrade(ALL);
              setStatus(ALL);
              setScorePreset(ALL);
              setCustomBelow("");
              setCustomAbove("");
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
        searchKeys={[
          "fullName",
          "studentArmyNumber",
          "rank",
          "unit",
          "courseCode",
          "courseName",
          "intakeNumber",
        ]}
        searchPlaceholder="Search name, army number, unit, or course..."
        getRowKey={(row) => row.enrollmentId}
        onRowClick={(row) => router.push(`/enrollments/${row.enrollmentId}`)}
      />
    </div>
  );
}
