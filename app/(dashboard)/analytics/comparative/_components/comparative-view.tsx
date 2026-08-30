"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComparativeCharts } from "./comparative-charts";
import type {
  ComparisonMode,
  ComparisonResult,
} from "@/lib/utils/comparative-analytics";
import { ArrowLeftRight, BarChart3 } from "lucide-react";

interface IntakeOption {
  intakeId: number;
  intakeNumber: string;
  year: number;
  courseId: number;
  courseCode: string;
}

interface CourseOption {
  courseId: number;
  courseCode: string;
  courseName: string;
}

interface ComparativeViewProps {
  courses: CourseOption[];
  intakes: IntakeOption[];
  years: number[];
  comparison: ComparisonResult | null;
  mode: ComparisonMode;
  idA: string;
  idB: string;
}

const MODES: { value: ComparisonMode; label: string; description: string }[] = [
  {
    value: "intakes",
    label: "Intakes",
    description: "Compare two intakes (e.g. ROGC-17 vs ROGC-18)",
  },
  {
    value: "courses",
    label: "Courses",
    description: "Compare two courses across all intakes",
  },
  {
    value: "years",
    label: "Years",
    description: "Compare all training activity between two years",
  },
];

export function ComparativeView({
  courses,
  intakes,
  years,
  comparison,
  mode,
  idA,
  idB,
}: ComparativeViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/analytics/comparative?${params.toString()}`);
  }

  function renderOptions(mode: ComparisonMode) {
    if (mode === "intakes") {
      return intakes.map((i) => (
        <SelectItem key={i.intakeId} value={String(i.intakeId)}>
          {i.courseCode} · {i.intakeNumber} ({i.year})
        </SelectItem>
      ));
    }
    if (mode === "courses") {
      return courses.map((c) => (
        <SelectItem key={c.courseId} value={String(c.courseId)}>
          {c.courseCode} — {c.courseName}
        </SelectItem>
      ));
    }
    return years.map((y) => (
      <SelectItem key={y} value={String(y)}>
        {y}
      </SelectItem>
    ));
  }

  const optionLabel =
    mode === "intakes" ? "Intake" : mode === "courses" ? "Course" : "Year";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Select comparison
          </CardTitle>
          <CardDescription>
            Choose what to compare side by side. Results update when you click
            Compare.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Button
                key={m.value}
                type="button"
                variant={mode === m.value ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  updateParams({ mode: m.value, a: "", b: "" })
                }
              >
                {m.label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {MODES.find((m) => m.value === mode)?.description}
          </p>

          <form
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const a = (form.elements.namedItem("a") as HTMLSelectElement)
                ?.value;
              const b = (form.elements.namedItem("b") as HTMLSelectElement)
                ?.value;
              if (a && b) updateParams({ mode, a, b });
            }}
          >
            <div className="space-y-1">
              <Label>Side A — {optionLabel}</Label>
              <Select
                name="a"
                value={idA || undefined}
                onValueChange={(v) => updateParams({ mode, a: v, b: idB })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${optionLabel} A`} />
                </SelectTrigger>
                <SelectContent>{renderOptions(mode)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Side B — {optionLabel}</Label>
              <Select
                name="b"
                value={idB || undefined}
                onValueChange={(v) => updateParams({ mode, a: idA, b: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${optionLabel} B`} />
                </SelectTrigger>
                <SelectContent>{renderOptions(mode)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={!idA || !idB || idA === idB}
                className="w-full md:w-auto"
              >
                Compare
              </Button>
            </div>
          </form>

          {idA && idB && idA === idB && (
            <p className="text-sm text-destructive">
              Please select two different {optionLabel.toLowerCase()}s.
            </p>
          )}
        </CardContent>
      </Card>

      {comparison ? (
        <ComparativeCharts comparison={comparison} />
      ) : idA && idB && idA !== idB ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No data found for the selected comparison.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <BarChart3 className="mx-auto h-10 w-10 mb-3 opacity-40" />
            Select two items above and click Compare to see results.
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <Link href="/analytics" className="underline">
          Back to Analytics overview
        </Link>
      </p>
    </div>
  );
}
