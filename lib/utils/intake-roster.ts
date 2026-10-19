import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseIntakes, enrollments, students } from "@/lib/db/schema";
import { checkIndisciplineBan } from "./indiscipline-ban";
import { checkPrerequisites, getCoursePrerequisites } from "./prerequisites";
import { normalizeRank, normalizeRosterArmyNumber, type RosterRow } from "./roster-parse";

export const MAX_ROSTER_ROWS = 1000;

export type RosterStatus = "new" | "existing" | "enrolled" | "blocked";

export type RosterCheckRow = RosterRow & {
  status: RosterStatus;
  /** Name already stored for an existing student. */
  currentName: string | null;
  /** True when the uploaded name replaces a shorter stored one. */
  updatesName: boolean;
  note: string | null;
};

export type RosterAnalysis = {
  intakeId: number;
  courseId: number;
  rows: RosterCheckRow[];
};

/** Name words that are not initials ("JD", "K.E.") count as full names. */
function fullNameWords(name: string): number {
  return name
    .split(/\s+/)
    .filter((w) => !w.includes(".") && w.replace(/[^A-Za-z]/g, "").length >= 3).length;
}

function isFullerName(next: string, current: string): boolean {
  return fullNameWords(next) > fullNameWords(current);
}

async function mapInChunks<T, R>(list: T[], size: number, fn: (item: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(...(await Promise.all(list.slice(i, i + size).map(fn))));
  }
  return out;
}

function sanitize(row: RosterRow): RosterRow {
  const rank = row.rank.trim();
  return {
    armyNumber: normalizeRosterArmyNumber(row.armyNumber) ?? row.armyNumber.trim().toUpperCase(),
    rank: (normalizeRank(rank) ?? rank.toUpperCase()).slice(0, 30),
    fullName: row.fullName.replace(/\s+/g, " ").trim().toUpperCase().slice(0, 100),
    unit: row.unit?.replace(/\s+/g, " ").trim().toUpperCase().slice(0, 100) || null,
    gender: row.gender === "female" ? "female" : row.gender === "male" ? "male" : null,
  };
}

/**
 * Classifies each uploaded student against SOFA without writing anything:
 * new student, existing student, already in this intake, or blocked.
 */
export async function analyzeRoster(
  intakeId: number,
  input: RosterRow[]
): Promise<RosterAnalysis | { error: string }> {
  if (input.length === 0) return { error: "No students found in the list." };
  if (input.length > MAX_ROSTER_ROWS) {
    return { error: `Too many rows (${input.length}). The limit is ${MAX_ROSTER_ROWS} per upload.` };
  }

  const [intake] = await db
    .select({ courseId: courseIntakes.courseId })
    .from(courseIntakes)
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);
  if (!intake) return { error: "Intake not found." };

  const seen = new Set<string>();
  const rows = input.map(sanitize).filter((r) => {
    if (seen.has(r.armyNumber)) return false;
    seen.add(r.armyNumber);
    return true;
  });
  const armyNumbers = [...seen];

  const [known, enrolledHere, disciplined, prerequisites] = await Promise.all([
    db
      .select({
        armyNumber: students.armyNumber,
        fullName: students.fullName,
        rank: students.rank,
        unit: students.unit,
      })
      .from(students)
      .where(inArray(students.armyNumber, armyNumbers)),
    db
      .select({ armyNumber: enrollments.studentArmyNumber })
      .from(enrollments)
      .where(and(eq(enrollments.intakeId, intakeId), inArray(enrollments.studentArmyNumber, armyNumbers))),
    db
      .selectDistinct({ armyNumber: enrollments.studentArmyNumber })
      .from(enrollments)
      .where(
        and(eq(enrollments.status, "indiscipline"), inArray(enrollments.studentArmyNumber, armyNumbers))
      ),
    getCoursePrerequisites(intake.courseId),
  ]);

  const knownBy = new Map(known.map((s) => [s.armyNumber, s]));
  const enrolledSet = new Set(enrolledHere.map((e) => e.armyNumber));

  const bans = new Map(
    await mapInChunks(disciplined, 8, async ({ armyNumber }) => {
      const ban = await checkIndisciplineBan(armyNumber);
      return [armyNumber, ban.blocked ? ban.message : null] as const;
    })
  );

  const prereqNotes = new Map<string, string>();
  if (prerequisites.length > 0) {
    const required = prerequisites.map((p) => p.courseCode).join(", ");
    const checks = await mapInChunks(
      armyNumbers.filter((a) => knownBy.has(a) && !enrolledSet.has(a)),
      8,
      async (armyNumber) => [armyNumber, await checkPrerequisites(armyNumber, intake.courseId)] as const
    );
    for (const [armyNumber, check] of checks) {
      if (!check.eligible) prereqNotes.set(armyNumber, `Prerequisites not on record — ${check.message}`);
    }
    for (const armyNumber of armyNumbers) {
      if (!knownBy.has(armyNumber)) {
        prereqNotes.set(armyNumber, `New to SOFA — no record of prerequisite ${required}`);
      }
    }
  }

  const checked: RosterCheckRow[] = rows.map((row) => {
    const current = knownBy.get(row.armyNumber) ?? null;
    const base = {
      ...row,
      rank: row.rank || current?.rank || "",
      unit: row.unit ?? current?.unit ?? null,
      currentName: current?.fullName ?? null,
      updatesName: false,
    };

    if (!normalizeRosterArmyNumber(row.armyNumber)) {
      return { ...base, status: "blocked", note: "Army number is not valid (e.g. MT 123456 or P 12345)." };
    }
    if (enrolledSet.has(row.armyNumber)) {
      return { ...base, status: "enrolled", note: "Already enrolled in this intake." };
    }
    const ban = bans.get(row.armyNumber);
    if (ban) return { ...base, status: "blocked", note: ban };
    if (!row.fullName) return { ...base, status: "blocked", note: "Name is missing." };
    if (!base.rank) return { ...base, status: "blocked", note: "Rank is missing." };

    const updatesName = !!current && isFullerName(row.fullName, current.fullName);
    const notes = [
      updatesName ? `Name will be updated from "${current!.fullName}".` : null,
      prereqNotes.get(row.armyNumber) ?? null,
    ].filter(Boolean);
    return {
      ...base,
      status: current ? "existing" : "new",
      updatesName,
      note: notes.length ? notes.join(" ") : null,
    };
  });

  return { intakeId, courseId: intake.courseId, rows: checked };
}

export type RosterEnrollSummary = {
  enrolled: number;
  newStudents: number;
  namesUpdated: number;
  skipped: Array<{ armyNumber: string; fullName: string; reason: string }>;
};

/** Creates missing students, refreshes rank/unit, and enrolls them in the intake. */
export async function enrollRoster(
  intakeId: number,
  input: RosterRow[]
): Promise<RosterEnrollSummary | { error: string }> {
  const analysis = await analyzeRoster(intakeId, input);
  if ("error" in analysis) return analysis;

  const ready = analysis.rows.filter((r) => r.status === "new" || r.status === "existing");
  const skipped = analysis.rows
    .filter((r) => r.status === "enrolled" || r.status === "blocked")
    .map((r) => ({ armyNumber: r.armyNumber, fullName: r.fullName, reason: r.note ?? r.status }));

  const fresh = ready.filter((r) => r.status === "new");
  if (fresh.length > 0) {
    await db
      .insert(students)
      .values(
        fresh.map((r) => ({
          armyNumber: r.armyNumber,
          fullName: r.fullName,
          rank: r.rank,
          gender: r.gender ?? "male",
          unit: r.unit,
          isActive: true,
        }))
      )
      .onConflictDoNothing();
  }

  const now = new Date();
  await mapInChunks(
    ready.filter((r) => r.status === "existing"),
    8,
    (r) =>
      db
        .update(students)
        .set({
          rank: r.rank,
          unit: r.unit,
          ...(r.updatesName ? { fullName: r.fullName } : {}),
          ...(r.gender ? { gender: r.gender } : {}),
          isActive: true,
          updatedAt: now,
        })
        .where(eq(students.armyNumber, r.armyNumber))
  );

  const inserted =
    ready.length === 0
      ? []
      : await db
          .insert(enrollments)
          .values(
            ready.map((r) => ({
              studentArmyNumber: r.armyNumber,
              intakeId,
              rankAtEnrollment: r.rank,
              unitAtEnrollment: r.unit,
              status: "enrolled" as const,
            }))
          )
          .onConflictDoNothing()
          .returning({ armyNumber: enrollments.studentArmyNumber });

  return {
    enrolled: inserted.length,
    newStudents: fresh.length,
    namesUpdated: ready.filter((r) => r.updatesName).length,
    skipped,
  };
}
