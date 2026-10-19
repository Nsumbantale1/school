"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadExcel, type SpreadsheetRows } from "@/lib/utils/spreadsheet";
import { importProgressWorkbook } from "../actions";

export function ProgressImport({
  intakeId,
  filename,
  rows,
}: {
  intakeId: number;
  filename: string;
  rows: SpreadsheetRows;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
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
        <CardTitle className="text-base">Add this month's results</CardTitle>
        <CardDescription>
          The course coordinator uploads an Excel file for the weeks just tested.
          Marks already on the chart stay. A blank cell does not remove an earlier week.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1 text-sm">
            <span className="font-medium">Excel file</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <Button type="submit" disabled={!file || pending}>
            {pending ? "Importing…" : "Import into this chart"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void downloadExcel(filename, rows, "Progress")}
          >
            Excel template
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
