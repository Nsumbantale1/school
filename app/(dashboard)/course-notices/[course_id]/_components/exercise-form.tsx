"use client";

import { useState } from "react";
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
import { Loader2, Plus } from "lucide-react";
import { createCourseExercise } from "../../actions";

export function ExerciseForm({ courseId }: { courseId: number }) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("courseId", String(courseId));
    const result = await createCourseExercise(formData);
    setPending(false);
    if (result.success) {
      toast.success("Exercise added to training programme.");
      e.currentTarget.reset();
    } else {
      toast.error(result.error ?? "Failed to add exercise.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="weekNumber">Week</Label>
          <Input
            id="weekNumber"
            name="weekNumber"
            type="number"
            min={1}
            max={52}
            placeholder="e.g. 3"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="exerciseType">Type</Label>
          <Select name="exerciseType" defaultValue="practical">
            <SelectTrigger id="exerciseType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="theory">Theory</SelectItem>
              <SelectItem value="practical">Practical</SelectItem>
              <SelectItem value="firing">Firing / Range</SelectItem>
              <SelectItem value="pt">PT</SelectItem>
              <SelectItem value="field">Field</SelectItem>
              <SelectItem value="assessment">Assessment</SelectItem>
              <SelectItem value="drill">Drill</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ex-title">Exercise title</Label>
          <Input
            id="ex-title"
            name="title"
            placeholder="e.g. Basic marksmanship — Stage 1"
            required
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            placeholder="Details, requirements, equipment..."
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" placeholder="e.g. Range 1" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="duration">Duration</Label>
          <Input id="duration" name="duration" placeholder="e.g. 3 days" />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-2 h-4 w-4" />
        )}
        Add Exercise
      </Button>
    </form>
  );
}
