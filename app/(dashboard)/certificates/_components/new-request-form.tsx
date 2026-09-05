"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import {
  createCertificateRequest,
  getEligibleStudentsAction,
} from "../actions";

type IntakeOption = {
  intakeId: number;
  label: string;
};

type StudentRow = {
  enrollmentId: number;
  armyNumber: string;
  fullName: string;
  rank: string;
  grade: string | null;
  averageMarks: string | null;
  unit: string | null;
  position: number | null;
};

export function NewCertificateRequestForm({
  intakes,
}: {
  intakes: IntakeOption[];
}) {
  const router = useRouter();
  const [intakeId, setIntakeId] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [pending, setPending] = useState(false);
  const [intakeLabel, setIntakeLabel] = useState("");

  async function loadStudents(id: string) {
    setIntakeId(id);
    setSelected(new Set());
    setStudents([]);
    if (!id) return;
    setLoadingStudents(true);
    const result = await getEligibleStudentsAction(parseInt(id, 10));
    setLoadingStudents(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to load students.");
      return;
    }
    setStudents(result.students);
    setIntakeLabel(
      `${result.intake.courseCode} · ${result.intake.intakeNumber}`
    );
  }

  const allIds = useMemo(
    () => students.map((s) => s.enrollmentId),
    [students]
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(allIds) : new Set());
  }

  async function handleSubmit() {
    if (!intakeId || selected.size === 0) {
      toast.error("Select an intake and at least one student.");
      return;
    }
    setPending(true);
    const result = await createCertificateRequest({
      intakeId: parseInt(intakeId, 10),
      enrollmentIds: [...selected],
      notes,
      submit: true,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to create request.");
      return;
    }
    toast.success(
      `Request ${result.requestNumber} submitted — ${result.certificateCount} certificate(s) pending Chief Instructor approval.`
    );
    router.push(`/certificates/${result.requestId}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-lg">
        <Label>Intake</Label>
        <Select value={intakeId} onValueChange={loadStudents}>
          <SelectTrigger>
            <SelectValue placeholder="Select course intake…" />
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

      {loadingStudents && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading eligible students…
        </p>
      )}

      {!loadingStudents && intakeId && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{intakeLabel || "Selected intake"}</p>
              <p className="text-xs text-muted-foreground">
                Eligible students: {students.length} · Selected for approval:{" "}
                <span className="font-semibold text-foreground">
                  {selected.size}
                </span>{" "}
                certificate{selected.size === 1 ? "" : "s"}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={
                  students.length > 0 && selected.size === students.length
                }
                onCheckedChange={(v) => toggleAll(!!v)}
              />
              Select all eligible
            </label>
          </div>

          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No eligible students in this intake.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3 py-2" />
                    <th className="px-3 py-2">Army No</th>
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Grade</th>
                    <th className="px-3 py-2">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.enrollmentId} className="border-t">
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={selected.has(s.enrollmentId)}
                          onCheckedChange={() => toggle(s.enrollmentId)}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {s.armyNumber}
                      </td>
                      <td className="px-3 py-2">{s.rank}</td>
                      <td className="px-3 py-2 font-medium">{s.fullName}</td>
                      <td className="px-3 py-2">{s.grade ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {s.unit ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-2 max-w-xl">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Graduation parade 12 Sep 2026"
              rows={2}
            />
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={pending || selected.size === 0}
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Submit for approval ({selected.size} certificate
            {selected.size === 1 ? "" : "s"})
          </Button>
        </div>
      )}
    </div>
  );
}
