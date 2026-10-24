"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { importProgressWorkbook } from "../actions";

export function CoordinatorDesk({
  courseId,
  intakes,
}: {
  courseId: number;
  intakes: { intakeId: number; label: string }[];
}) {
  const router = useRouter();
  const [intakeId, setIntakeId] = useState(intakes[0]?.intakeId ?? 0);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !intakeId) return;
    setPending(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await importProgressWorkbook(intakeId, formData);
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Could not import the file.");
      return;
    }
    toast.success(result.message ?? "Marks added to the chart.");
    setFile(null);
    router.refresh();
  }

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-base">Coordinator</CardTitle>
        <CardDescription>
          Create the intake for this course, then upload the weekly test as Excel or PDF.
          The file needs an Army No column and week columns such as 1, 2, 3 or M-1.
          Saved marks stay as they are until the Chief Instructor authorizes a change.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button asChild>
          <Link href={`/intakes/new?courseId=${courseId}`}>
            <Plus className="mr-2 h-4 w-4" />
            Create intake
          </Link>
        </Button>

        {intakes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This course has no intake running yet. Create one, enrol the students, then upload the weekly test.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="space-y-1 text-sm lg:w-56">
              <span className="font-medium">Intake</span>
              <select
                className="block h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={intakeId}
                onChange={(event) => setIntakeId(Number(event.target.value))}
              >
                {intakes.map((intake) => (
                  <option key={intake.intakeId} value={intake.intakeId}>
                    {intake.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 space-y-1 text-sm">
              <span className="font-medium">Weekly test file</span>
              <input
                type="file"
                accept=".xlsx,.xls,.pdf,application/pdf"
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <Button type="submit" disabled={!file || pending}>
              {pending ? "Importing…" : "Upload results"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
