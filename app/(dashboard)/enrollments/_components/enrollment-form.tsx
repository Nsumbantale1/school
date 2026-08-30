"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/searchable-select";
import { AlertCircle, CheckCircle } from "lucide-react";
import { createEnrollment } from "../actions";
import { BackButton } from "@/components/back-button";

interface Student {
  armyNumber: string;
  rank: string;
  fullName: string;
}

interface Intake {
  intakeId: number;
  intakeNumber: string;
  year: number;
  courseCode: string;
  courseName: string;
}

interface EnrollmentFormProps {
  students: Student[];
  intakes: Intake[];
  defaultIntakeId?: number;
  defaultStudentArmyNumber?: string;
  backHref?: string;
}

export function EnrollmentForm({
  students,
  intakes,
  defaultIntakeId,
  defaultStudentArmyNumber,
  backHref = "/enrollments",
}: EnrollmentFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [prerequisiteError, setPrerequisiteError] = React.useState<string | null>(null);
  const [indisciplineError, setIndisciplineError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setPrerequisiteError(null);
    setIndisciplineError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createEnrollment(formData);

    setPending(false);

    if (result.success) {
      toast.success("Enrollment created successfully.");
      router.push("/enrollments");
    } else if ((result as { indisciplineError?: boolean }).indisciplineError) {
      setIndisciplineError(result.error ?? "Enrollment blocked.");
    } else if ((result as { prerequisiteError?: boolean }).prerequisiteError) {
      setPrerequisiteError(result.error ?? "Prerequisites not met.");
    } else {
      toast.error(result.error ?? "An error occurred.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      {indisciplineError && (
        <Card className="border-purple-500 bg-purple-50 dark:bg-purple-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-purple-800 dark:text-purple-300 flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4" />
              Indiscipline Case — Enrollment Blocked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{indisciplineError}</p>
          </CardContent>
        </Card>
      )}

      {prerequisiteError && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4" />
              Prerequisites Not Met
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{prerequisiteError}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Label htmlFor="studentArmyNumber">Student</Label>
        <SearchableSelect
          id="studentArmyNumber"
          name="studentArmyNumber"
          defaultValue={defaultStudentArmyNumber}
          required
          placeholder="Search by name, rank, or army number..."
          options={students.map((s) => ({
            value: s.armyNumber,
            label: `${s.rank} ${s.fullName} (${s.armyNumber})`,
            searchText: `${s.rank} ${s.fullName} ${s.armyNumber}`,
          }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="intakeId">Course Intake</Label>
        <SearchableSelect
          id="intakeId"
          name="intakeId"
          defaultValue={defaultIntakeId?.toString()}
          required
          placeholder="Search course or intake..."
          options={intakes.map((i) => ({
            value: i.intakeId.toString(),
            label: `${i.courseCode} - ${i.courseName} (${i.intakeNumber}, ${i.year})`,
            searchText: `${i.courseCode} ${i.courseName} ${i.intakeNumber} ${i.year}`,
          }))}
        />
        <p className="text-sm text-muted-foreground">
          Prerequisites and indiscipline checks run automatically before enrollment.
        </p>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Enrollment"}
        </Button>
        <BackButton fallbackHref={backHref} label="Cancel" />
      </div>
    </form>
  );
}
