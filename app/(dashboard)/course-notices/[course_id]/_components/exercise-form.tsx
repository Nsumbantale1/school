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

export function ExerciseForm({
  courseId,
  defaultWeek,
  periodKind = "week",
}: {
  courseId: number;
  defaultWeek?: number;
  periodKind?: "week" | "month";
}) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("courseId", String(courseId));
    const result = await createCourseExercise(formData);
    setPending(false);
    if (result.success) {
      toast.success(
        defaultWeek == null
          ? "Exercise added to training programme."
          : periodKind === "month"
            ? "Monthly test added."
            : "Weekly test added."
      );
      e.currentTarget.reset();
    } else {
      toast.error(result.error ?? "Failed to add exercise.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <input type="hidden" name="periodKind" value={periodKind} />
          <Label htmlFor="weekNumber">
            {periodKind === "month" ? "Month" : "Week"}
          </Label>
          {defaultWeek != null ? (
            <>
              <input type="hidden" name="weekNumber" value={defaultWeek} />
              <p
                id="weekNumber"
                className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium"
              >
                {periodKind === "month" ? "Month" : "Week"} {defaultWeek}
              </p>
            </>
          ) : (
            <Input
              id="weekNumber"
              name="weekNumber"
              type="number"
              min={1}
              max={52}
              placeholder="e.g. 3"
              required
            />
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="exerciseType">Type</Label>
          <Select
            name="exerciseType"
            defaultValue={periodKind === "week" && defaultWeek == null ? "practical" : "assessment"}
          >
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
          <Label htmlFor="ex-title">
            {defaultWeek == null ? "Exercise title" : "Test title"}
          </Label>
          <Input
            id="ex-title"
            name="title"
            placeholder={
              periodKind === "month"
                ? "e.g. Monthly test — Gunnery"
                : defaultWeek != null
                  ? "e.g. Weekly test — Map reading"
                  : "e.g. Basic marksmanship — Stage 1"
            }
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
        {defaultWeek == null
          ? "Add Exercise"
          : periodKind === "month"
            ? "Add monthly test"
            : "Add weekly test"}
      </Button>
    </form>
  );
}
