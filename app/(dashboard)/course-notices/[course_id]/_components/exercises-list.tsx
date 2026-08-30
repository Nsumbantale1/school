"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, MapPin, Clock } from "lucide-react";
import { deleteCourseExercise } from "../../actions";

interface ExerciseRow {
  id: number;
  weekNumber: number;
  title: string;
  description: string | null;
  exerciseType: string;
  location: string | null;
  duration: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  theory: "Theory",
  practical: "Practical",
  firing: "Firing / Range",
  pt: "PT",
  field: "Field",
  assessment: "Assessment",
  drill: "Drill",
  other: "Other",
};

export function ExercisesList({
  exercises,
  courseId,
  canManage,
}: {
  exercises: ExerciseRow[];
  courseId: number;
  canManage: boolean;
}) {
  const [deleting, setDeleting] = useState<number | null>(null);

  async function handleDelete(id: number) {
    if (!confirm("Delete this exercise?")) return;
    setDeleting(id);
    const result = await deleteCourseExercise(id, courseId);
    setDeleting(null);
    if (result.success) toast.success("Exercise deleted.");
    else toast.error("Failed to delete exercise.");
  }

  if (exercises.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No exercises in the training programme yet. Add progressive exercises above.
      </p>
    );
  }

  const byWeek = exercises.reduce<Record<number, ExerciseRow[]>>((acc, ex) => {
    if (!acc[ex.weekNumber]) acc[ex.weekNumber] = [];
    acc[ex.weekNumber].push(ex);
    return acc;
  }, {});

  const weeks = Object.keys(byWeek)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {weeks.map((week) => (
        <div key={week}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              {week}
            </span>
            Week {week}
          </h3>
          <div className="space-y-2 ml-8 border-l-2 border-muted pl-4">
            {byWeek[week].map((ex) => (
              <Card key={ex.id}>
                <CardContent className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{ex.title}</p>
                      <Badge variant="secondary" className="text-xs">
                        {TYPE_LABELS[ex.exerciseType] ?? ex.exerciseType}
                      </Badge>
                    </div>
                    {ex.description && (
                      <p className="text-sm text-muted-foreground">{ex.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {ex.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {ex.location}
                        </span>
                      )}
                      {ex.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {ex.duration}
                        </span>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      disabled={deleting === ex.id}
                      onClick={() => handleDelete(ex.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
