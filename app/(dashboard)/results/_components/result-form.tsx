"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { createResult, updateResult } from "../actions";
import { calculateGrade } from "@/lib/utils/grades";

interface Enrollment {
  enrollmentId: number;
  studentArmyNumber: string;
  fullName: string;
  rank: string;
  courseCode: string;
  intakeNumber: string;
}

interface ResultFormProps {
  enrollments: Enrollment[];
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
  defaultEnrollmentId,
  initialData,
}: ResultFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [marks, setMarks] = React.useState(
    initialData?.marksObtained ? parseFloat(initialData.marksObtained) : 0
  );
  const [maxMarks, setMaxMarks] = React.useState(
    initialData?.maxMarks ? parseFloat(initialData.maxMarks) : 100
  );
  const isEditing = !!initialData;

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
        <Select
          name="enrollmentId"
          defaultValue={
            initialData?.enrollmentId?.toString() ??
            defaultEnrollmentId?.toString()
          }
          disabled={isEditing}
          required
        >
          <SelectTrigger id="enrollmentId">
            <SelectValue placeholder="Select an enrollment..." />
          </SelectTrigger>
          <SelectContent>
            {enrollments.map((e) => (
              <SelectItem key={e.enrollmentId} value={e.enrollmentId.toString()}>
                {e.rank} {e.fullName} - {e.courseCode} ({e.intakeNumber})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subjectName">Subject Name</Label>
        <Input
          id="subjectName"
          name="subjectName"
          required
          disabled={isEditing}
          placeholder="e.g., Artillery Tactics"
          defaultValue={initialData?.subjectName ?? ""}
        />
        <p className="text-sm text-muted-foreground">
          Enter the subject or module name for this result.
        </p>
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
