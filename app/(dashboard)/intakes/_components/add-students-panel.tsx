"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileUp, Loader2, RefreshCw, Search, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadExcel } from "@/lib/utils/spreadsheet";
import type { RosterRow } from "@/lib/utils/roster-parse";
import type { RosterCheckRow, RosterStatus } from "@/lib/utils/intake-roster";
import {
  enrollRosterRows,
  findStudentForRoster,
  previewRosterRows,
  previewRosterUpload,
} from "../roster-actions";

const STATUS: Record<
  RosterStatus,
  { label: string; variant: "success" | "secondary" | "outline" | "destructive" }
> = {
  new: { label: "New to SOFA", variant: "secondary" },
  existing: { label: "Existing student", variant: "success" },
  enrolled: { label: "Already enrolled", variant: "outline" },
  blocked: { label: "Blocked", variant: "destructive" },
};

const ACCEPT = ".xlsx,.xls,.csv,.docx,.pdf";

const nativeSelect =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function toRow(r: RosterCheckRow): RosterRow {
  return {
    armyNumber: r.armyNumber,
    rank: r.rank,
    fullName: r.fullName,
    unit: r.unit,
    gender: r.gender,
  };
}

const selectable = (r: RosterCheckRow) => r.status === "new" || r.status === "existing";

function summaryToast(result: {
  enrolled: number;
  newStudents: number;
  namesUpdated: number;
  skipped: Array<{ armyNumber: string; reason: string }>;
}) {
  const parts = [`Enrolled ${result.enrolled} student${result.enrolled === 1 ? "" : "s"}`];
  if (result.newStudents) parts.push(`${result.newStudents} new to SOFA`);
  if (result.namesUpdated) parts.push(`${result.namesUpdated} names completed`);
  if (result.skipped.length) parts.push(`${result.skipped.length} skipped`);
  if (result.enrolled > 0) toast.success(parts.join(" · "));
  else toast.error(result.skipped[0]?.reason ?? "No students were enrolled.");
}

export function AddStudentsPanel({
  intakeId,
  intakeLabel,
}: {
  intakeId: number;
  intakeLabel: string;
}) {
  return (
    <Card id="add-students" className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Add students to this intake
        </CardTitle>
        <CardDescription>
          Orodha ya majina pekee (Excel, Word au PDF). Excel yenye wanafunzi na alama iwekwe
          kwenye Import Excel hapa chini — data itaingia kwenye intake hii.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">
              <FileUp className="h-4 w-4" />
              Upload list
            </TabsTrigger>
            <TabsTrigger value="single">
              <UserPlus className="h-4 w-4" />
              Add one student
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="pt-4">
            <RosterUpload intakeId={intakeId} intakeLabel={intakeLabel} />
          </TabsContent>
          <TabsContent value="single" className="pt-4">
            <SingleStudentForm intakeId={intakeId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function RosterUpload({ intakeId, intakeLabel }: { intakeId: number; intakeLabel: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<RosterCheckRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState<"read" | "check" | "enroll" | null>(null);

  const counts = useMemo(() => {
    const c: Record<RosterStatus, number> = { new: 0, existing: 0, enrolled: 0, blocked: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  function load(next: RosterCheckRow[]) {
    setRows(next);
    setSelected(new Set(next.flatMap((r, i) => (selectable(r) ? [i] : []))));
    setEdited(false);
  }

  function reset() {
    setRows([]);
    setSelected(new Set());
    setWarnings([]);
    setFileName("");
    setEdited(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function readFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose an Excel, Word or PDF file first.");
      return;
    }
    setBusy("read");
    const form = new FormData();
    form.append("file", file);
    const result = await previewRosterUpload(intakeId, form);
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setFileName(file.name);
    setWarnings(result.warnings);
    load(result.rows);
  }

  function edit(index: number, field: "armyNumber" | "rank" | "fullName" | "unit", value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    setEdited(true);
  }

  async function recheck() {
    setBusy("check");
    const result = await previewRosterRows(intakeId, rows.map(toRow));
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    load(result.rows);
  }

  async function enroll() {
    const chosen = rows.filter((r, i) => selected.has(i) && selectable(r)).map(toRow);
    if (chosen.length === 0) {
      toast.error("Select at least one student to enroll.");
      return;
    }
    setBusy("enroll");
    const result = await enrollRosterRows(intakeId, chosen);
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    summaryToast(result);
    if (result.enrolled > 0) {
      reset();
      router.refresh();
    }
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const selectableCount = rows.filter(selectable).length;
  const chosenCount = rows.filter((r, i) => selected.has(i) && selectable(r)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="roster-file">Course roll (msururu)</Label>
          <Input
            id="roster-file"
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="max-w-sm"
            onChange={() => rows.length && reset()}
          />
        </div>
        <Button type="button" onClick={readFile} disabled={busy !== null}>
          {busy === "read" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="mr-2 h-4 w-4" />
          )}
          Read file
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            downloadExcel(
              `Msururu-template-${intakeLabel}`.replace(/[^\w.-]+/g, "_"),
              [
                ["Army Number", "Rank", "Full Name", "Unit", "Gender"],
                ["MT 123456", "PTE", "JOHN PETER MUSSA", "971 REGT", "M"],
              ],
              "Msururu"
            )
          }
        >
          <Download className="mr-2 h-4 w-4" />
          Excel template
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Accepted: Excel (.xlsx, .xls, .csv), Word (.docx) and PDF. Each student needs an army
        number; rank, full name and unit are read from the same row. Scanned PDFs (photos) cannot
        be read.
      </p>

      {warnings.map((w) => (
        <p key={w} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {w}
        </p>
      ))}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {fileName}: {rows.length} student{rows.length === 1 ? "" : "s"} found
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(STATUS) as RosterStatus[])
                  .filter((s) => counts[s] > 0)
                  .map((s) => (
                    <Badge key={s} variant={STATUS[s].variant}>
                      {STATUS[s].label}: {counts[s]}
                    </Badge>
                  ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {edited && (
                <Button type="button" variant="outline" onClick={recheck} disabled={busy !== null}>
                  {busy === "check" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Re-check edits
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={reset} disabled={busy !== null}>
                Cancel
              </Button>
              <Button type="button" onClick={enroll} disabled={busy !== null || chosenCount === 0}>
                {busy === "enroll" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Enroll {chosenCount} student{chosenCount === 1 ? "" : "s"}
              </Button>
            </div>
          </div>

          <div className="max-h-[32rem] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <Checkbox
                      checked={selectableCount > 0 && chosenCount === selectableCount}
                      onCheckedChange={(v) =>
                        setSelected(
                          v ? new Set(rows.flatMap((r, i) => (selectable(r) ? [i] : []))) : new Set()
                        )
                      }
                    />
                  </th>
                  <th className="px-2 py-2">Army No</th>
                  <th className="px-2 py-2">Rank</th>
                  <th className="px-2 py-2">Full name</th>
                  <th className="px-2 py-2">Unit</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selected.has(i) && selectable(r)}
                        disabled={!selectable(r)}
                        onCheckedChange={() => toggle(i)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={r.armyNumber}
                        onChange={(e) => edit(i, "armyNumber", e.target.value)}
                        className="h-8 w-32 font-mono text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={r.rank}
                        onChange={(e) => edit(i, "rank", e.target.value)}
                        className="h-8 w-20"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={r.fullName}
                        onChange={(e) => edit(i, "fullName", e.target.value)}
                        className="h-8 min-w-[14rem]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={r.unit ?? ""}
                        onChange={(e) => edit(i, "unit", e.target.value)}
                        className="h-8 w-28"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge>
                      {r.note && (
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{r.note}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SingleStudentForm({ intakeId }: { intakeId: number }) {
  const router = useRouter();
  const [armyNumber, setArmyNumber] = useState("");
  const [rank, setRank] = useState("");
  const [fullName, setFullName] = useState("");
  const [unit, setUnit] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [lookup, setLookup] = useState<"idle" | "existing" | "new">("idle");
  const [busy, setBusy] = useState<"find" | "enroll" | null>(null);

  function clear() {
    setArmyNumber("");
    setRank("");
    setFullName("");
    setUnit("");
    setGender("male");
    setLookup("idle");
  }

  async function find() {
    if (!armyNumber.trim()) return;
    setBusy("find");
    const result = await findStudentForRoster(armyNumber);
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setArmyNumber(result.armyNumber);
    if (result.student) {
      setRank(result.student.rank);
      setFullName(result.student.fullName);
      setUnit(result.student.unit ?? "");
      setGender(result.student.gender === "female" ? "female" : "male");
      setLookup("existing");
    } else {
      setLookup("new");
    }
  }

  async function enroll(e: React.FormEvent) {
    e.preventDefault();
    if (!armyNumber.trim() || !rank.trim() || !fullName.trim()) {
      toast.error("Army number, rank and full name are required.");
      return;
    }
    setBusy("enroll");
    const result = await enrollRosterRows(intakeId, [
      { armyNumber, rank, fullName, unit: unit || null, gender },
    ]);
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    summaryToast(result);
    if (result.enrolled > 0) {
      clear();
      router.refresh();
    }
  }

  return (
    <form onSubmit={enroll} className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="single-army">Army number</Label>
          <Input
            id="single-army"
            value={armyNumber}
            onChange={(e) => {
              setArmyNumber(e.target.value);
              setLookup("idle");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void find();
              }
            }}
            placeholder="MT 123456"
            className="w-44 font-mono"
          />
        </div>
        <Button type="button" variant="outline" onClick={find} disabled={busy !== null}>
          {busy === "find" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Find
        </Button>
        {lookup === "existing" && <Badge variant="success">Existing student — details filled in</Badge>}
        {lookup === "new" && <Badge variant="secondary">Not in SOFA — will be created</Badge>}
      </div>

      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="single-rank">Rank</Label>
          <Input
            id="single-rank"
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            placeholder="PTE"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="single-name">Full name (all three names)</Label>
          <Input
            id="single-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="JOHN PETER MUSSA"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <div className="space-y-1.5">
          <Label htmlFor="single-unit">Unit</Label>
          <Input
            id="single-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="971 REGT"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="single-gender">Gender</Label>
          <select
            id="single-gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as "male" | "female")}
            className={nativeSelect}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>

      <Button type="submit" disabled={busy !== null}>
        {busy === "enroll" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" />
        )}
        Enroll student
      </Button>
    </form>
  );
}
