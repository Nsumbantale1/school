"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle } from "lucide-react";
import { createEnrollment } from "../actions";

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
}

export function EnrollmentForm({
  students,
  intakes,
  defaultIntakeId,
  defaultStudentArmyNumber,
}: EnrollmentFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [prerequisiteError, setPrerequisiteError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setPrerequisiteError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createEnrollment(formData);

    setPending(false);

    if (result.success) {
      toast.success("Enrollment created successfully.");
      router.push("/enrollments");
    } else if ((result as any).prerequisiteError) {
      setPrerequisiteError((result as any).error);
    } else {
      toast.error(result.error ?? "An error occurred.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
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
        <Select
          name="studentArmyNumber"
          defaultValue={defaultStudentArmyNumber}
          required
        >
          <SelectTrigger id="studentArmyNumber">
            <SelectValue placeholder="Select a student..." />
          </SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.armyNumber} value={s.armyNumber}>
                {s.rank} {s.fullName} ({s.armyNumber})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="intakeId">Course Intake</Label>
        <Select
          name="intakeId"
          defaultValue={defaultIntakeId?.toString()}
          required
        >
          <SelectTrigger id="intakeId">
            <SelectValue placeholder="Select an intake..." />
          </SelectTrigger>
          <SelectContent>
            {intakes.map((i) => (
              <SelectItem key={i.intakeId} value={i.intakeId.toString()}>
                {i.courseCode} - {i.courseName} ({i.intakeNumber}, {i.year})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Prerequisites will be checked automatically before enrollment.
        </p>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Enrollment"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
