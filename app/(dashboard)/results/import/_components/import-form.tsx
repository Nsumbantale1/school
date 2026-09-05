"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  getImportTemplateData,
  importResultsFromCsv,
  importOfficialSofaWorkbook,
} from "../actions";
import {
  downloadExcel,
  isSpreadsheetFile,
  parseSpreadsheetFile,
  rowsToCsvText,
} from "@/lib/utils/spreadsheet";
import { downloadCsv } from "@/lib/utils/csv";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Upload, Loader2, FileSpreadsheet } from "lucide-react";

interface IntakeOption {
  intakeId: number;
  label: string;
}

export function ImportResultsForm({
  intakes,
  defaultIntakeId,
  canImportOfficial = false,
}: {
  intakes: IntakeOption[];
  defaultIntakeId?: number;
  canImportOfficial?: boolean;
}) {
  const router = useRouter();
  const [intakeId, setIntakeId] = React.useState<string>(
    defaultIntakeId ? String(defaultIntakeId) : ""
  );
  const [fileName, setFileName] = React.useState<string>("");
  const [csvText, setCsvText] = React.useState("");
  const [updateExisting, setUpdateExisting] = React.useState(true);
  const [loadingTemplate, setLoadingTemplate] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importingOfficial, setImportingOfficial] = React.useState(false);
  const [officialFiles, setOfficialFiles] = React.useState<File[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setMessage(null);
    setErrors([]);

    if (!isSpreadsheetFile(file)) {
      setMessage("Please upload an Excel (.xlsx) or CSV (.csv) file.");
      setCsvText("");
      return;
    }

    try {
      const rows = await parseSpreadsheetFile(file);
      if (rows.length < 2) {
        setMessage("File must have a header row and at least one student row.");
        setCsvText("");
        return;
      }
      setCsvText(rowsToCsvText(rows));
    } catch (err) {
      setMessage((err as Error).message || "Could not read file.");
      setCsvText("");
    }
  };

  const buildTemplateRows = async () => {
    if (!intakeId) {
      setMessage("Select an intake first.");
      return null;
    }

    const data = await getImportTemplateData(Number(intakeId));
    if (!data.success) {
      setMessage(data.error || "Failed to build template.");
      return null;
    }

    const subjectNames =
      data.subjects.length > 0
        ? data.subjects.map((s) => s.subjectName)
        : ["Subject 1", "Subject 2", "Subject 3"];

    const header = ["Army Number", "Full Name", "Rank", ...subjectNames];
    const rows: (string | number)[][] = [header];

    for (const student of data.roster) {
      rows.push([
        student.armyNumber,
        student.fullName,
        student.rank,
        ...subjectNames.map(() => ""),
      ]);
    }

    if (rows.length === 1) {
      setMessage("This intake has no enrolled students yet.");
      return null;
    }

    return { rows, data, subjectNames };
  };

  const handleDownloadExcel = async () => {
    setLoadingTemplate(true);
    setMessage(null);
    setErrors([]);
    try {
      const built = await buildTemplateRows();
      if (!built) return;

      const safeName = `${built.data.intake.courseCode}-${built.data.intake.intakeNumber}`
        .replace(/[^\w.-]+/g, "_");
      await downloadExcel(`results-template-${safeName}.xlsx`, built.rows);
      setMessage(
        built.subjectNames.length <= 3
          ? "Excel template downloaded. Fill marks and upload the same file."
          : "Excel template downloaded with all subjects. Fill marks and upload."
      );
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleDownloadCsv = async () => {
    setLoadingTemplate(true);
    setMessage(null);
    setErrors([]);
    try {
      const built = await buildTemplateRows();
      if (!built) return;

      const safeName = `${built.data.intake.courseCode}-${built.data.intake.intakeNumber}`
        .replace(/[^\w.-]+/g, "_");
      downloadCsv(`results-template-${safeName}.csv`, built.rows);
      setMessage("CSV template downloaded.");
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleImport = async () => {
    if (!intakeId) {
      setMessage("Select an intake first.");
      return;
    }
    if (!csvText.trim()) {
      setMessage("Choose an Excel or CSV file to upload.");
      return;
    }

    setImporting(true);
    setMessage(null);
    setErrors([]);
    try {
      const formData = new FormData();
      formData.set("intakeId", intakeId);
      formData.set("csvText", csvText);
      formData.set("updateExisting", updateExisting ? "true" : "false");

      const result = await importResultsFromCsv(formData);
      if (!result.success) {
        setMessage(result.error || "Import failed.");
        setErrors(result.errors || []);
        return;
      }

      setMessage(result.message || "Import complete.");
      setErrors(result.errors || []);
      router.refresh();
    } finally {
      setImporting(false);
    }
  };

  const handleOfficialImport = async () => {
    if (officialFiles.length === 0) {
      setMessage("Choose one or more official SOFA Excel workbooks.");
      return;
    }

    setImportingOfficial(true);
    setMessage(null);
    setErrors([]);
    const lines: string[] = [];
    const fail: string[] = [];

    try {
      for (const file of officialFiles) {
        const formData = new FormData();
        formData.set("file", file);
        const result = await importOfficialSofaWorkbook(formData);
        if (result.success) {
          lines.push(result.message || file.name);
        } else {
          fail.push(`${file.name}: ${result.error || "failed"}`);
        }
      }

      setMessage(
        lines.length
          ? lines.join(" ")
          : fail[0] || "Official workbook import finished."
      );
      setErrors(fail);
      if (lines.length) router.refresh();
    } finally {
      setImportingOfficial(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {canImportOfficial && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Official SOFA workbook (recommended)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload the original course Excel files (MSURURU / RIPOTI YA MAFUNZO).
            The system creates the course, intake, students, enrollments, and
            subject marks automatically.
          </p>
          <div className="space-y-2">
            <Label htmlFor="sofa-workbook">Excel workbooks (.xlsx)</Label>
            <input
              id="sofa-workbook"
              type="file"
              multiple
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) =>
                setOfficialFiles(Array.from(e.target.files ?? []))
              }
              className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            />
            {officialFiles.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Selected: {officialFiles.map((f) => f.name).join(", ")}
              </p>
            )}
          </div>
          <Button
            type="button"
            onClick={handleOfficialImport}
            disabled={officialFiles.length === 0 || importingOfficial}
          >
            {importingOfficial ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Import official workbooks
          </Button>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Or use a simple marks template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Intake / Course</Label>
            <Select value={intakeId} onValueChange={setIntakeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select intake" />
              </SelectTrigger>
              <SelectContent>
                {intakes.map((i) => (
                  <SelectItem key={i.intakeId} value={String(i.intakeId)}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadExcel}
              disabled={!intakeId || loadingTemplate}
            >
              {loadingTemplate ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download Excel (.xlsx)
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleDownloadCsv}
              disabled={!intakeId || loadingTemplate}
            >
              Download CSV
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Template includes all enrolled students. Coordinator fills marks in
            Excel, then uploads the <strong>.xlsx</strong> file directly (no need
            to convert to CSV).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Step 2 — Upload filled Excel or CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="spreadsheet-file">Excel or CSV file</Label>
            <input
              id="spreadsheet-file"
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={onFileChange}
              className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            />
            {fileName && (
              <p className="text-sm text-muted-foreground">Selected: {fileName}</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
            />
            Update marks if subject result already exists
          </label>

          <Button
            type="button"
            onClick={handleImport}
            disabled={!intakeId || !csvText || importing}
          >
            {importing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Import results
          </Button>
        </CardContent>
      </Card>

      {message && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-sm font-medium">{message}</p>
            {errors.length > 0 && (
              <ul className="text-sm text-muted-foreground list-disc pl-5 max-h-48 overflow-y-auto">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
