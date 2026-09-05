import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PositionBadge } from "@/components/position-badge";
import {
  fmtScore,
  formatBccGrade,
  type BccParsedReport,
} from "@/lib/utils/bcc-report";

export type FinalCourseReportProps = {
  forceNo: string;
  rank: string;
  fullName: string;
  unit: string | null;
  courseCode: string;
  courseName: string;
  intakeNumber: string;
  commenced: string | Date | null;
  completed: string | Date | null;
  position: number | null;
  classSize?: number | null;
  enrollmentHref?: string;
  photoPath?: string | null;
  report: BccParsedReport;
};

function formatLongDate(value: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).toUpperCase();
}

export function FinalCourseReport({
  forceNo,
  rank,
  fullName,
  unit,
  courseCode,
  courseName,
  intakeNumber,
  commenced,
  completed,
  position,
  classSize,
  enrollmentHref,
  photoPath,
  report,
}: FinalCourseReportProps) {
  const gradeText = formatBccGrade(report.tpdfGrade, report.tpdfRemarks);
  const isGood = report.tpdfGrade.toUpperCase() === "C";

  return (
    <div className="final-course-report space-y-6 print:space-y-4">
      <div className="text-center border-b pb-4 print:border-black">
        <Image
          src="/school-of-artillery.png"
          alt="School of Field Artillery"
          width={88}
          height={88}
          className="mx-auto mb-2 h-20 w-20 object-contain"
        />
        <p className="text-xs tracking-[0.2em] text-muted-foreground print:text-black">
          TANZANIA PEOPLE&apos;S DEFENCE FORCES
        </p>
        <p className="text-sm font-semibold tracking-wide mt-1">
          SCHOOL OF FIELD ARTILLERY — MONDULI
        </p>
        <p className="text-xs text-muted-foreground print:text-black">
          (HOME OF ARTILLERY)
        </p>
        <h2 className="text-lg font-bold mt-3 tracking-wide">
          FINAL COURSE REPORT
        </h2>
        <p className="text-sm text-muted-foreground mt-1 print:text-black">
          {courseName} ({courseCode}) · Intake {intakeNumber}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-semibold tabular-nums">
            {fmtScore(report.overall)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Total marks</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-semibold">{gradeText}</p>
          <p className="text-xs text-muted-foreground mt-1">Grade / remarks</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-semibold tabular-nums">
            {fmtScore(report.theoryMarks)} / {fmtScore(report.theoryWeight, 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Theory &amp; practical (40%)
          </p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-semibold tabular-nums">
            {fmtScore(report.fieldMarks)} / {fmtScore(report.fieldWeight, 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Field exercises (60%)
          </p>
        </div>
      </div>

      <Card className="print:shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Part One — Personal details</CardTitle>
          <div className="flex items-center gap-2">
            {position != null && <PositionBadge position={position} />}
            {classSize != null && (
              <Badge variant="outline">of {classSize}</Badge>
            )}
            {enrollmentHref && (
              <Button variant="outline" size="sm" asChild className="print:hidden">
                <Link href={enrollmentHref}>Open enrollment</Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Force no</dt>
              <dd className="font-medium font-mono">{forceNo}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rank</dt>
              <dd className="font-medium">{rank}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Full name</dt>
              <dd className="font-medium">{fullName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Unit</dt>
              <dd className="font-medium">{unit || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Intake</dt>
              <dd className="font-medium">{intakeNumber}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Commenced</dt>
              <dd className="font-medium">{formatLongDate(commenced)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Completed</dt>
              <dd className="font-medium">{formatLongDate(completed)}</dd>
            </div>
            </dl>
            <div className="mx-auto h-36 w-28 shrink-0 overflow-hidden rounded-md border bg-muted sm:mx-0">
              {photoPath ? (
                <img
                  src={photoPath}
                  alt={fullName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                  Photograph
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="print:shadow-none print:break-inside-avoid">
        <CardHeader>
          <CardTitle className="text-base">
            Part Two — Theory &amp; practical results (40%)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Theory %</TableHead>
                <TableHead className="text-right">Practical %</TableHead>
                <TableHead className="text-right">Total %</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Marks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.theory.map((row) => (
                <TableRow key={row.subject}>
                  <TableCell className="font-medium">{row.subject}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtScore(row.theory, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtScore(row.practical, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtScore(row.total, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtScore(row.weight, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {fmtScore(row.marks)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">TOTAL</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">
                  {fmtScore(report.theoryWeight, 0)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {fmtScore(report.theoryMarks)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="print:shadow-none print:break-inside-avoid">
        <CardHeader>
          <CardTitle className="text-base">
            Part Three — Field exercises results (60%)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exercise</TableHead>
                <TableHead className="text-right">Score %</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Marks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.field.map((row) => (
                <TableRow key={row.exercise}>
                  <TableCell className="font-medium">{row.exercise}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtScore(row.score, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtScore(row.weight, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {fmtScore(row.marks)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">TOTAL</TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">
                  {fmtScore(report.fieldWeight, 0)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {fmtScore(report.fieldMarks)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="print:shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Part Four — Grading</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total marks (%)</p>
              <p className="text-3xl font-semibold tabular-nums">
                {fmtScore(report.overall)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Grade</p>
              <p className="text-3xl font-semibold">{report.tpdfGrade || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remarks</p>
              <p className={`text-3xl font-semibold ${isGood ? "" : "text-muted-foreground"}`}>
                {report.tpdfRemarks || "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
