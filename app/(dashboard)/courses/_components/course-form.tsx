"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { createCourse, updateCourse } from "../actions";

interface SubjectRow {
  subjectName: string;
  maxMarks: string;
}

interface CourseFormProps {
  initialData?: {
    courseId: number;
    courseCode: string;
    courseName: string;
    durationWeeks: number;
    passingMark: number;
    description: string | null;
    subjects: SubjectRow[];
  };
}

export function CourseForm({ initialData }: CourseFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [subjects, setSubjects] = React.useState<SubjectRow[]>(
    initialData?.subjects?.length
      ? initialData.subjects
      : [{ subjectName: "", maxMarks: "100" }],
  );
  const isEditing = !!initialData;

  function updateSubject(idx: number, field: keyof SubjectRow, value: string) {
    setSubjects((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    );
  }

  function addSubject() {
    setSubjects((prev) => [...prev, { subjectName: "", maxMarks: "100" }]);
  }

  function removeSubject(idx: number) {
    setSubjects((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);

    const cleaned = subjects
      .map((s) => ({
        subjectName: s.subjectName.trim(),
        maxMarks: s.maxMarks.trim() || "100",
      }))
      .filter((s) => s.subjectName.length > 0);
    formData.set("subjects", JSON.stringify(cleaned));

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
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
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
          <p className="text-xs text-muted-foreground">Default: 40%</p>
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

      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <Label>Subjects</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSubject}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Subject
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Subjects entered here will appear when recording results for this
          course.
        </p>
        <div className="space-y-2">
          {subjects.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <Input
                placeholder="Subject name (e.g., Artillery Tactics)"
                value={s.subjectName}
                onChange={(e) =>
                  updateSubject(i, "subjectName", e.target.value)
                }
                className="flex-1"
              />
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="Max"
                value={s.maxMarks}
                onChange={(e) => updateSubject(i, "maxMarks", e.target.value)}
                className="w-24"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSubject(i)}
                disabled={subjects.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
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
