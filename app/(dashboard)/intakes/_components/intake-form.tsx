"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createIntake, updateIntake } from "../actions";

interface Course {
  courseId: number;
  courseCode: string;
  courseName: string;
}

interface IntakeFormProps {
  courses: Course[];
  initialData?: {
    intakeId: number;
    courseId: number;
    intakeNumber: string;
    year: number;
    commanderName: string | null;
    coordinatorName: string | null;
    startDate: string;
    endDate: string | null;
  };
  defaultCourseId?: number;
}

export function IntakeForm({ courses, initialData, defaultCourseId }: IntakeFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const isEditing = !!initialData;

  // Generate default intake number
  const currentYear = new Date().getFullYear();
  const defaultIntakeNumber = `INT-${currentYear}-01`;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);

    const result = isEditing
      ? await updateIntake(initialData.intakeId, formData)
      : await createIntake(formData);

    setPending(false);

    if (result.success) {
      toast.success(isEditing ? "Intake updated." : "Intake created.");
      router.push("/intakes");
    } else {
      toast.error(result.error ?? "An error occurred.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="courseId">Course</Label>
        <Select
          name="courseId"
          defaultValue={
            initialData?.courseId?.toString() ??
            defaultCourseId?.toString() ??
            ""
          }
          disabled={isEditing}
        >
          <SelectTrigger id="courseId">
            <SelectValue placeholder="Select a course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.courseId} value={course.courseId.toString()}>
                {course.courseCode} - {course.courseName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="intakeNumber">Intake Number</Label>
          <Input
            id="intakeNumber"
            name="intakeNumber"
            required
            placeholder="e.g., INT-2024-01"
            defaultValue={initialData?.intakeNumber ?? defaultIntakeNumber}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Input
            id="year"
            name="year"
            type="number"
            min="2000"
            max="2100"
            required
            defaultValue={initialData?.year ?? currentYear}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="commanderName">Commander Name</Label>
          <Input
            id="commanderName"
            name="commanderName"
            placeholder="e.g., Col. John Doe"
            defaultValue={initialData?.commanderName ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="coordinatorName">Coordinator Name</Label>
          <Input
            id="coordinatorName"
            name="coordinatorName"
            placeholder="e.g., Maj. Jane Smith"
            defaultValue={initialData?.coordinatorName ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={initialData?.startDate ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={initialData?.endDate ?? ""}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : isEditing ? "Update Intake" : "Create Intake"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
