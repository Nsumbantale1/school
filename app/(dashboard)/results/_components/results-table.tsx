"use client";

import * as React from "react";
import { GradeBadge } from "@/components/grade-badge";
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

interface ResultRow {
  resultId: number;
  studentArmyNumber: string;
  fullName: string;
  unit: string | null;
  rank: string;
  courseCode: string;
  intakeNumber: string;
  subjectName: string;
  marksObtained: string;
  maxMarks: string;
  grade: string | null;
  enteredByName: string | null;
}

const ALL = "__all__";

const columns: Column<ResultRow>[] = [
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
    cell: (row) =>
      `${parseFloat(row.marksObtained).toFixed(1)} / ${parseFloat(row.maxMarks).toFixed(0)}`,
  },
  {
    key: "percentage",
    header: "Percentage",
    cell: (row) => {
      const max = parseFloat(row.maxMarks);
      const percentage = max > 0 ? (parseFloat(row.marksObtained) / max) * 100 : 0;
      return `${percentage.toFixed(1)}%`;
    },
  },
  {
    key: "grade",
    header: "Grade",
    cell: (row) => (
      <GradeBadge grade={row.grade as "A" | "B" | "C" | "D" | "F" | null} />
    ),
  },
  {
    key: "enteredByName",
    header: "Entered By",
    cell: (row) => row.enteredByName ?? "—",
  },
];

function subjectPercent(row: ResultRow): number {
  const max = parseFloat(row.maxMarks);
  if (!Number.isFinite(max) || max <= 0) return 0;
  const got = parseFloat(row.marksObtained);
  return Number.isFinite(got) ? (got / max) * 100 : 0;
}

export function ResultsTable({ data }: { data: ResultRow[] }) {
  const [course, setCourse] = React.useState(ALL);
  const [unit, setUnit] = React.useState(ALL);
  const [grade, setGrade] = React.useState(ALL);
  const [customBelow, setCustomBelow] = React.useState("");

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

  const filtered = React.useMemo(() => {
    const below = customBelow.trim() !== "" ? parseFloat(customBelow) : null;
    return data.filter((row) => {
      if (course !== ALL && row.courseCode !== course) return false;
      if (unit !== ALL && row.unit !== unit) return false;
      if (grade !== ALL && row.grade !== grade) return false;
      if (below != null && Number.isFinite(below)) {
        if (subjectPercent(row) >= below) return false;
      }
      return true;
    });
  }, [data, course, unit, grade, customBelow]);

  const hasFilter =
    course !== ALL ||
    unit !== ALL ||
    grade !== ALL ||
    customBelow.trim() !== "";

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

        <div className="space-y-1">
          <Label htmlFor="result-below" className="text-xs text-muted-foreground">
            Subject below %
          </Label>
          <Input
            id="result-below"
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

        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCourse(ALL);
              setUnit(ALL);
              setGrade(ALL);
              setCustomBelow("");
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
          "intakeNumber",
          "subjectName",
        ]}
        searchPlaceholder="Search name, army number, unit, course, or subject..."
        getRowKey={(row) => row.resultId}
      />
    </div>
  );
}
