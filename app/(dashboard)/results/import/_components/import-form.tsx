"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  getImportTemplateData,
  importResultsFromCsv,
  importOfficialSofaWorkbook,
  importExcelIntoIntake,
} from "../actions";
import {
  downloadExcel,
  isSpreadsheetFile,
  parseSpreadsheetFile,
  rowsToCsvText,
} from "@/lib/utils/spreadsheet";
import { downloadCsv } from "@/lib/utils/csv";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Upload, Loader2, FileSpreadsheet, Plus } from "lucide-react";
import Link from "next/link";

interface IntakeOption {
  intakeId: number;
  label: string;
}

export function ImportResultsForm({
  intakes,
  defaultIntakeId,
  canImportOfficial = false,
  embedded = false,
  courseLabel,
  newIntakeHref,
}: {
  intakes: IntakeOption[];
  defaultIntakeId?: number;
  canImportOfficial?: boolean;
  /** Compact layout for course / intake pages */
  embedded?: boolean;
  courseLabel?: string;
  /** Shown when this course has no intakes yet */
  newIntakeHref?: string;
}) {
  const router = useRouter();
  const [intakeId, setIntakeId] = React.useState<string>(
    defaultIntakeId
      ? String(defaultIntakeId)
      : intakes.length === 1
        ? String(intakes[0].intakeId)
        : ""
  );
  const [fileName, setFileName] = React.useState<string>("");
  const [csvText, setCsvText] = React.useState("");
  const [updateExisting, setUpdateExisting] = React.useState(true);
  const [changeReason, setChangeReason] = React.useState("");
  const [loadingTemplate, setLoadingTemplate] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importingOfficial, setImportingOfficial] = React.useState(false);
  const [officialFiles, setOfficialFiles] = React.useState<File[]>([]);
  const [intakeFile, setIntakeFile] = React.useState<File | null>(null);
  const [importingIntake, setImportingIntake] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (defaultIntakeId) {
      setIntakeId(String(defaultIntakeId));
    }
  }, [defaultIntakeId]);

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
      formData.set("changeReason", changeReason);

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

  const showIntakeSelect = intakes.length > 1 || !intakeId;
  const titlePrefix = courseLabel ? `${courseLabel} — ` : "";

  const intakeLabel = intakes.find((i) => String(i.intakeId) === intakeId)?.label;

  const handleIntakeImport = async () => {
    if (!intakeId) {
      setMessage("Intake haijulikani.");
      return;
    }
    if (!intakeFile) {
      setMessage("Chagua faili la Excel kwanza.");
      return;
    }
    setImportingIntake(true);
    setMessage(null);
    setErrors([]);
    try {
      const formData = new FormData();
      formData.set("file", intakeFile);
      formData.set("intakeId", intakeId);
      formData.set("updateExisting", updateExisting ? "true" : "false");
      formData.set("changeReason", changeReason);
      const result = await importExcelIntoIntake(formData);
      if (!result.success) {
        setMessage(result.error || "Import failed.");
        setErrors("errors" in result && result.errors ? result.errors : []);
        return;
      }
      setMessage(result.message || "Import complete.");
      setErrors("errors" in result && result.errors ? result.errors : []);
      setIntakeFile(null);
      router.refresh();
    } finally {
      setImportingIntake(false);
    }
  };

  if (embedded) {
    return (
      <div className="space-y-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4" />
              Import Excel into this intake
            </CardTitle>
            <CardDescription>
              Weka Excel ya kozi hapa, kisha bofya Import. Wanafunzi na alama
              zitaingia kwenye intake hii
              {intakeLabel ? ` (${intakeLabel})` : ""}, si intake nyingine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {intakes.length === 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Hakuna intake — tengeneza kwanza.
                </p>
                {newIntakeHref && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={newIntakeHref}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      New Intake
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="intake-excel">Excel file</Label>
                  <Input
                    id="intake-excel"
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    onChange={(e) => {
                      setIntakeFile(e.target.files?.[0] ?? null);
                      setMessage(null);
                      setErrors([]);
                    }}
                  />
                  {intakeFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {intakeFile.name}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleIntakeImport}
                    disabled={!intakeFile || importingIntake}
                  >
                    {importingIntake ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Import into this intake
                  </Button>
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
                    Excel template
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                  />
                  Ask approval to change existing marks
                </label>
                {updateExisting && (
                  <Input
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="Reason if existing marks change (goes to CI → Commandant)"
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {message && (
          <div className="rounded-md border px-3 py-2 text-xs space-y-1">
            <p className="font-medium">{message}</p>
            {errors.length > 0 && (
              <ul className="text-muted-foreground list-disc pl-4 max-h-24 overflow-y-auto">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {canImportOfficial && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Official SOFA workbook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload original course Excel files — per-student RIPOTI YA MAFUNZO,
              or a MATOKEO YA… summary sheet (A/NO + subject columns). The system
              creates intake, students, enrollments and marks automatically.
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

      {intakes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              {titlePrefix}Import marks (Excel / CSV)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Kozi hii bado haina intake. Tengeneza intake na enroll wanafunzi
              kwanza, au (admin) tumia Official SOFA workbook hapo juu —
              itatengeneza intake na matokeo moja kwa moja.
            </p>
            {newIntakeHref && (
              <Button asChild>
                <Link href={newIntakeHref}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Intake
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              {titlePrefix}Import marks (Excel / CSV)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Download the roster template, fill subject marks, then upload the
              same file. Wide format (one column per subject) or long format
              (Army Number, Subject, Marks) both work. After import the system
              updates averages, grades, status and positions.
            </p>

            {showIntakeSelect ? (
              <div className="space-y-2">
                <Label>Intake</Label>
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
            ) : (
              intakes[0] && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Intake: </span>
                  <span className="font-medium">{intakes[0].label}</span>
                </p>
              )
            )}

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
                Download Excel template
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

            <div className="space-y-2">
              <Label htmlFor="spreadsheet-file">Upload filled Excel or CSV</Label>
              <input
                id="spreadsheet-file"
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={onFileChange}
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
              />
              {fileName && (
                <p className="text-sm text-muted-foreground">
                  Selected: {fileName}
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
              />
              Ask approval to change marks that are already recorded
            </label>
            {updateExisting && (
              <div className="space-y-1">
                <Input
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Reason if existing marks change"
                  className="max-w-lg"
                />
                <p className="text-xs text-muted-foreground">
                  New marks are saved at once. Marks that are already recorded are only changed
                  after the Chief Instructor and then the Commandant approve.
                </p>
              </div>
            )}

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
      )}

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
