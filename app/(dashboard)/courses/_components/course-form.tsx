"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCourse, updateCourse } from "../actions";

interface CourseFormProps {
  initialData?: {
    courseId: number;
    courseCode: string;
    courseName: string;
    durationWeeks: number;
    passingMark: number;
    description: string | null;
  };
}

export function CourseForm({ initialData }: CourseFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const isEditing = !!initialData;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);

    const result = isEditing
      ? await updateCourse(initialData.courseId, formData)
      : await createCourse(formData);

    setPending(false);

    if (result.success) {
      toast.success(isEditing ? "Course updated." : "Course created.");
      router.push("/courses");
    } else {
      toast.error(result.error ?? "An error occurred.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="courseCode">Course Code</Label>
        <Input
          id="courseCode"
          name="courseCode"
          required
          placeholder="e.g., FA-101"
          defaultValue={initialData?.courseCode ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="courseName">Course Name</Label>
        <Input
          id="courseName"
          name="courseName"
          required
          placeholder="e.g., Basic Artillery Operations"
          defaultValue={initialData?.courseName ?? ""}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="durationWeeks">Duration (weeks)</Label>
          <Input
            id="durationWeeks"
            name="durationWeeks"
            type="number"
            min="1"
            max="52"
            required
            defaultValue={initialData?.durationWeeks ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passingMark">Passing Mark (%)</Label>
          <Input
            id="passingMark"
            name="passingMark"
            type="number"
            min="0"
            max="100"
            required
            defaultValue={initialData?.passingMark ?? 40}
          />
          <p className="text-xs text-muted-foreground">
            Default: 40%
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Course description and objectives..."
          defaultValue={initialData?.description ?? ""}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : isEditing ? "Update Course" : "Create Course"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
