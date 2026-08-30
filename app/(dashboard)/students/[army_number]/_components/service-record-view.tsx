import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { DownloadCertificateButton } from "@/components/download-certificate-button";
import { isEligibleForCertificate } from "@/lib/utils/certificate-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeBadge } from "@/components/grade-badge";
import { PositionBadge } from "@/components/position-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  Calendar,
  Mail,
  Phone,
  Shield,
  User,
} from "lucide-react";
import type { StudentServiceRecord } from "@/lib/utils/student-service-record";

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function SummaryStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: "success" | "danger" | "warning" | "purple";
}) {
  const colors = {
    success: "text-green-700 dark:text-green-400",
    danger: "text-red-700 dark:text-red-400",
    warning: "text-orange-700 dark:text-orange-400",
    purple: "text-purple-700 dark:text-purple-400",
  };

  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <p
        className={`text-2xl font-bold ${highlight ? colors[highlight] : ""}`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export function ServiceRecordView({ record }: { record: StudentServiceRecord }) {
  const { student, summary, activeBan, indisciplineHistory, enrollments } =
    record;

  return (
    <div className="service-record relative space-y-6">
      {/* Screen-only watermark */}
      <div
        className="str-watermark-screen pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden print:hidden"
        aria-hidden
      >
        <Image
          src="/school-of-artillery.png"
          alt=""
          width={480}
          height={480}
          className="max-h-[70vh] w-auto object-contain opacity-[0.06]"
          priority
        />
      </div>

      <div className="relative z-[1] space-y-6">
      {/* Print-only official header */}
      <div className="hidden print:block print-header border-b-2 border-black pb-4 mb-6 text-center">
        <h1 className="text-xl font-bold">
          TANZANIA PEOPLE&apos;S DEFENCE FORCE
        </h1>
        <h1 className="text-xl font-bold mt-1">
          SCHOOL OF FIELD ARTILLERY
        </h1>
        <h2 className="text-sm font-semibold tracking-wide mt-2">
          STUDENT TRAINING RECORD
        </h2>
        <p className="text-sm mt-2">
          Ref: {record.referenceNumber} · Generated:{" "}
          {formatDate(record.generatedAt)}
        </p>
      </div>

      {/* Screen header card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent print:border print:shadow-none">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 print:border print:border-black">
                <Shield className="h-8 w-8 text-primary print:text-black" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wide print:text-black">
                  Student Training Record
                </p>
                <h2 className="text-2xl font-bold">
                  {student.rank} {student.fullName}
                </h2>
                <p className="font-mono text-sm text-muted-foreground mt-1 print:text-black">
                  Army No. {student.armyNumber}
                </p>
                <p className="text-xs text-muted-foreground mt-1 print:text-black">
                  Ref: {record.referenceNumber}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Badge variant={student.isActive ? "default" : "secondary"}>
                {student.isActive ? "Active" : "Inactive"}
              </Badge>
              {activeBan.blocked && (
                <Badge variant="destructive">Enrollment Ban Active</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {activeBan.blocked && (
        <Card className="border-destructive bg-destructive/5 print:border print:border-black">
          <CardContent className="pt-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5 print:text-black" />
            <div>
              <p className="font-semibold text-destructive print:text-black">
                Active Indiscipline Ban
              </p>
              <p className="text-sm mt-1">{activeBan.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary stats */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 print:text-black">
          Service Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <SummaryStat label="Total Courses" value={summary.totalCourses} />
          <SummaryStat label="Passed" value={summary.passed} highlight="success" />
          <SummaryStat label="Failed" value={summary.failed} highlight="danger" />
          <SummaryStat
            label="Incomplete"
            value={summary.incomplete}
            highlight="warning"
          />
          <SummaryStat
            label="Indiscipline"
            value={summary.indiscipline}
            highlight="purple"
          />
          <SummaryStat label="Enrolled" value={summary.enrolled} />
          <SummaryStat label="In Progress" value={summary.inProgress} />
          <SummaryStat label="Subject Results" value={summary.subjectResults} />
        </div>
      </div>

      <Card className="print:shadow-none print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground print:text-black">Current Rank</dt>
                <dd className="font-medium">{student.rank}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground print:text-black">Gender</dt>
                <dd className="capitalize">{student.gender}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground print:text-black">Date of Birth</dt>
                <dd>{formatDate(student.dateOfBirth)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground print:text-black">Status</dt>
                <dd>{student.isActive ? "Active" : "Inactive"}</dd>
              </div>
              {student.unit && (
                <div className="col-span-2 flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 print:hidden" />
                  <div>
                    <dt className="text-muted-foreground print:text-black">Unit</dt>
                    <dd>{student.unit}</dd>
                  </div>
                </div>
              )}
              {student.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 print:hidden" />
                  <div>
                    <dt className="text-muted-foreground print:text-black">Phone</dt>
                    <dd>{student.phone}</dd>
                  </div>
                </div>
              )}
              {student.email && (
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 print:hidden" />
                  <div>
                    <dt className="text-muted-foreground print:text-black">Email</dt>
                    <dd className="break-all">{student.email}</dd>
                  </div>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

      {/* Course history table */}
      <Card className="print:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Course History
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No course enrollments.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Intake</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Average</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Pos.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e) => (
                  <TableRow key={e.enrollmentId}>
                    <TableCell>
                      <p className="font-medium">{e.courseCode}</p>
                      <p className="text-xs text-muted-foreground print:text-black">
                        {e.courseName}
                      </p>
                    </TableCell>
                    <TableCell>{e.intakeNumber}</TableCell>
                    <TableCell>{e.year}</TableCell>
                    <TableCell>
                      <span className="font-medium">{e.rankAtEnrollment}</span>
                      {e.rankAtEnrollment !== student.rank && (
                        <p className="text-xs text-muted-foreground print:text-black">
                          now {student.rank}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.unitAtEnrollment ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                    <TableCell>
                      {e.averageMarks
                        ? `${parseFloat(e.averageMarks).toFixed(1)}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <GradeBadge grade={e.grade} />
                    </TableCell>
                    <TableCell>
                      <PositionBadge position={e.position} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Indiscipline history */}
      {indisciplineHistory.length > 0 && (
        <Card className="border-purple-200 print:shadow-none print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-purple-800 dark:text-purple-300 print:text-black">
              <AlertTriangle className="h-4 w-4" />
              Indiscipline Record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Intake</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Ceased</TableHead>
                  <TableHead>Eligible After</TableHead>
                  <TableHead>Ban Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indisciplineHistory.map((inc, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {inc.courseCode} — {inc.courseName}
                    </TableCell>
                    <TableCell>{inc.intakeNumber}</TableCell>
                    <TableCell>{inc.year}</TableCell>
                    <TableCell>{formatDate(inc.ceasedAt)}</TableCell>
                    <TableCell>{formatDate(inc.eligibleAfter)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={inc.isActive ? "destructive" : "secondary"}
                      >
                        {inc.isActive ? "Active ban" : "Expired"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Subject marks per course */}
      {enrollments.map((e) => {
        const certEligible = isEligibleForCertificate(
          e.status,
          e.grade,
          e.averageMarks,
          e.passingMark
        ).eligible;

        return (
        <Card
          key={`marks-${e.enrollmentId}`}
          className="print:shadow-none print:break-inside-avoid"
        >
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
            <CardTitle className="text-base">
              Subject Marks — {e.courseCode}
            </CardTitle>
            <p className="text-sm text-muted-foreground print:text-black">
              {e.courseName} · {e.intakeNumber} ({e.year}) · Rank:{" "}
              {e.rankAtEnrollment}
              {e.unitAtEnrollment ? ` · ${e.unitAtEnrollment}` : ""}
              {e.commanderName ? ` · Cmdr: ${e.commanderName}` : ""}
            </p>
            {(e.status === "incomplete" || e.status === "indiscipline") &&
              e.ceasedAt && (
                <p className="text-sm text-orange-700 dark:text-orange-400 print:text-black">
                  Training ceased: {formatDate(e.ceasedAt)}
                </p>
              )}
              </div>
              {certEligible && (
                <DownloadCertificateButton
                  enrollmentId={e.enrollmentId}
                  variant="outline"
                  size="sm"
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {e.subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No subject marks recorded.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {e.subjects.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {s.subjectName}
                      </TableCell>
                      <TableCell>
                        {s.marksObtained}/{s.maxMarks}
                      </TableCell>
                      <TableCell>{s.percentage.toFixed(1)}%</TableCell>
                      <TableCell>
                        <GradeBadge grade={s.grade} />
                      </TableCell>
                      <TableCell className="text-muted-foreground print:text-black">
                        {s.remarks || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="text-xs text-muted-foreground mt-3 print:hidden">
              <Link
                href={`/enrollments/${e.enrollmentId}`}
                className="hover:underline"
              >
                View enrollment details →
              </Link>
            </p>
          </CardContent>
        </Card>
        );
      })}

      {student.notes && (
        <Card className="print:shadow-none print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Administrative Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{student.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Print signature blocks */}
      <div className="hidden print:grid print:grid-cols-3 print:gap-8 print:mt-12 print:pt-8 print:border-t print:border-black">
        <div>
          <div className="border-b border-black h-12 mb-2" />
          <p className="text-xs font-semibold">Course Command</p>
          <p className="text-xs text-muted-foreground">Signature & Date</p>
        </div>
        <div>
          <div className="border-b border-black h-12 mb-2" />
          <p className="text-xs font-semibold">Chief Instructor</p>
          <p className="text-xs text-muted-foreground">Signature & Date</p>
        </div>
        <div>
          <div className="border-b border-black h-12 mb-2" />
          <p className="text-xs font-semibold">Commandant</p>
          <p className="text-xs text-muted-foreground">Signature & Date</p>
        </div>
      </div>

      <p className="text-xs text-center text-muted-foreground print:text-black print:mt-4">
        <Calendar className="inline h-3 w-3 mr-1 print:hidden" />
        Record generated {formatDate(record.generatedAt)} · School of Field
        Artillery · Confidential
      </p>
      </div>
    </div>
  );
}
