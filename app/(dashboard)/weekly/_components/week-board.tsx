"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Clock, MapPin, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { deleteCourseExercise } from "../../course-notices/actions";
import { ExerciseForm } from "../../course-notices/[course_id]/_components/exercise-form";

type ExerciseRow = {
  id: number;
  weekNumber: number;
  periodKind: string;
  title: string;
  description: string | null;
  exerciseType: string;
  location: string | null;
  duration: string | null;
};

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

export function WeekBoard({
  courseId,
  totalPeriods,
  initialPeriod,
  periodKind,
  exercises,
  canManage,
}: {
  courseId: number;
  totalPeriods: number;
  initialPeriod: number;
  periodKind: "week" | "month";
  exercises: ExerciseRow[];
  canManage: boolean;
}) {
  const unit = periodKind === "month" ? "Month" : "Week";
  const testName = periodKind === "month" ? "monthly test" : "weekly test";
  const [period, setPeriod] = useState(initialPeriod);
  const [deleting, setDeleting] = useState<number | null>(null);
  const rows = exercises.filter(
    (ex) => ex.periodKind === periodKind && ex.weekNumber === period
  );

  async function handleDelete(id: number) {
    if (!confirm(`Delete this ${testName}?`)) return;
    setDeleting(id);
    const result = await deleteCourseExercise(id, courseId);
    setDeleting(null);
    if (result.success) toast.success("Deleted.");
    else toast.error(result.error ?? "Failed to delete.");
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: totalPeriods }, (_, i) => i + 1).map((n) => {
          const count = exercises.filter(
            (ex) => ex.periodKind === periodKind && ex.weekNumber === n
          ).length;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setPeriod(n)}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                n === period
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:border-primary/40"
              )}
            >
              <span className="block font-semibold">{unit} {n}</span>
              <span className={cn(n === period ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {count} test{count === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Add {testName} — {unit.toLowerCase()} {period}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExerciseForm
              key={`${periodKind}-${period}`}
              courseId={courseId}
              defaultWeek={period}
              periodKind={periodKind}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {unit} {period} {testName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No {testName} for {unit.toLowerCase()} {period} yet.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-start justify-between gap-3 rounded-lg border px-3 py-3"
                >
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function TestTabs({
  courseId,
  totalWeeks,
  initialWeek,
  totalMonths,
  initialMonth,
  exercises,
  canManage,
}: {
  courseId: number;
  totalWeeks: number;
  initialWeek: number;
  totalMonths: number;
  initialMonth: number;
  exercises: ExerciseRow[];
  canManage: boolean;
}) {
  const weeklyCount = exercises.filter((ex) => ex.periodKind !== "month").length;
  const monthlyCount = exercises.filter((ex) => ex.periodKind === "month").length;

  return (
    <Tabs defaultValue="weekly" className="space-y-4">
      <TabsList>
        <TabsTrigger value="weekly">Weekly Test ({weeklyCount})</TabsTrigger>
        <TabsTrigger value="monthly">Monthly Test ({monthlyCount})</TabsTrigger>
      </TabsList>
      <TabsContent value="weekly">
        <WeekBoard
          courseId={courseId}
          totalPeriods={totalWeeks}
          initialPeriod={initialWeek}
          periodKind="week"
          exercises={exercises.map((ex) => ({
            ...ex,
            periodKind: ex.periodKind === "month" ? "month" : "week",
          }))}
          canManage={canManage}
        />
      </TabsContent>
      <TabsContent value="monthly">
        <WeekBoard
          courseId={courseId}
          totalPeriods={totalMonths}
          initialPeriod={initialMonth}
          periodKind="month"
          exercises={exercises}
          canManage={canManage}
        />
      </TabsContent>
    </Tabs>
  );
}
