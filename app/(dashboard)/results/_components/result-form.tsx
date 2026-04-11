"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/searchable-select";
import { Card, CardContent } from "@/components/ui/card";
import { createResult, updateResult } from "../actions";
import { calculateGrade } from "@/lib/utils/grades";

interface Enrollment {
  enrollmentId: number;
  studentArmyNumber: string;
  fullName: string;
  rank: string;
  courseCode: string;
  courseId: number;
  intakeNumber: string;
}

interface SubjectOption {
  subjectName: string;
  maxMarks: string;
}

interface ResultFormProps {
  enrollments: Enrollment[];
  subjectsByCourse: Record<number, SubjectOption[]>;
  defaultEnrollmentId?: number;
  initialData?: {
    resultId: number;
    enrollmentId: number;
    subjectName: string;
    marksObtained: string;
    maxMarks: string;
    remarks: string | null;
  };
}

export function ResultForm({
  enrollments,
  subjectsByCourse,
  defaultEnrollmentId,
  initialData,
}: ResultFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [enrollmentId, setEnrollmentId] = React.useState<string>(
    initialData?.enrollmentId?.toString() ??
      defaultEnrollmentId?.toString() ??
      "",
  );
  const [subjectName, setSubjectName] = React.useState<string>(
    initialData?.subjectName ?? "",
  );
  const [marks, setMarks] = React.useState(
    initialData?.marksObtained ? parseFloat(initialData.marksObtained) : 0
  );
  const [maxMarks, setMaxMarks] = React.useState(
    initialData?.maxMarks ? parseFloat(initialData.maxMarks) : 100
  );
  const isEditing = !!initialData;

  const selectedEnrollment = React.useMemo(
    () =>
      enrollments.find((e) => e.enrollmentId.toString() === enrollmentId),
    [enrollments, enrollmentId],
  );

  const availableSubjects = React.useMemo(() => {
    if (!selectedEnrollment) return [];
    return subjectsByCourse[selectedEnrollment.courseId] ?? [];
  }, [selectedEnrollment, subjectsByCourse]);

  React.useEffect(() => {
    if (isEditing) return;
    if (availableSubjects.length === 0) {
      setSubjectName("");
      return;
    }
    if (!availableSubjects.some((s) => s.subjectName === subjectName)) {
      setSubjectName("");
    }
  }, [availableSubjects, isEditing, subjectName]);

  React.useEffect(() => {
    if (isEditing) return;
    const match = availableSubjects.find((s) => s.subjectName === subjectName);
    if (match) {
      const parsed = parseFloat(match.maxMarks);
      if (!Number.isNaN(parsed)) setMaxMarks(parsed);
    }
  }, [subjectName, availableSubjects, isEditing]);

  // Calculate preview grade
  const previewGrade = calculateGrade(marks, maxMarks);
  const percentage = maxMarks > 0 ? (marks / maxMarks) * 100 : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);

    const result = isEditing
      ? await updateResult(initialData.resultId, formData)
      : await createResult(formData);

    setPending(false);

    if (result.success) {
      toast.success(isEditing ? "Result updated." : "Result created.");
      router.push("/results");
    } else {
      toast.error(result.error ?? "An error occurred.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="enrollmentId">Student Enrollment</Label>
        <SearchableSelect
          id="enrollmentId"
          name="enrollmentId"
          value={enrollmentId}
          onValueChange={setEnrollmentId}
          disabled={isEditing}
          required
          placeholder="Search by student, army no, or course..."
          options={enrollments.map((e) => ({
            value: e.enrollmentId.toString(),
            label: `${e.rank} ${e.fullName} - ${e.courseCode} (${e.intakeNumber})`,
            searchText: `${e.rank} ${e.fullName} ${e.studentArmyNumber} ${e.courseCode} ${e.intakeNumber}`,
          }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subjectName">Subject</Label>
        {isEditing ? (
          <Input
            id="subjectName"
            name="subjectName"
            value={subjectName}
            disabled
          />
        ) : availableSubjects.length > 0 ? (
          <SearchableSelect
            id="subjectName"
            name="subjectName"
            value={subjectName}
            onValueChange={setSubjectName}
            required
            placeholder="Select a subject for this course..."
            options={availableSubjects.map((s) => ({
              value: s.subjectName,
              label: `${s.subjectName} (max ${parseFloat(s.maxMarks)})`,
              searchText: s.subjectName,
            }))}
          />
        ) : (
          <>
            <Input
              id="subjectName"
              name="subjectName"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              required
              placeholder="e.g., Artillery Tactics"
            />
            <p className="text-xs text-muted-foreground">
              {selectedEnrollment
                ? "This course has no subjects defined yet — enter one manually or add subjects in the course settings."
                : "Select an enrollment first."}
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="marksObtained">Marks Obtained</Label>
          <Input
            id="marksObtained"
            name="marksObtained"
            type="number"
            step="0.01"
            min="0"
            required
            value={marks}
            onChange={(e) => setMarks(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxMarks">Maximum Marks</Label>
          <Input
            id="maxMarks"
            name="maxMarks"
            type="number"
            step="0.01"
            min="1"
            required
            value={maxMarks}
            onChange={(e) => setMaxMarks(parseFloat(e.target.value) || 100)}
          />
        </div>
      </div>

      {/* Grade Preview */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Preview</p>
              <p className="font-medium">
                {percentage.toFixed(1)}% - Grade{" "}
                <span
                  className={
                    previewGrade === "A"
                      ? "text-green-600"
                      : previewGrade === "B"
                        ? "text-blue-600"
                        : previewGrade === "C"
                          ? "text-yellow-600"
                          : previewGrade === "D"
                            ? "text-orange-600"
                            : "text-red-600"
                  }
                >
                  {previewGrade}
                </span>
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>A: 80%+ | B: 60-79%</p>
              <p>C: 50-59% | D: 40-49% | F: &lt;40%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="remarks">Remarks</Label>
        <Textarea
          id="remarks"
          name="remarks"
          rows={2}
          placeholder="Optional remarks..."
          defaultValue={initialData?.remarks ?? ""}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : isEditing ? "Update Result" : "Create Result"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
