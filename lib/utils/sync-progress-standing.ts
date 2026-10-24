import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { enrollments, progressTests } from "@/lib/db/schema";
import { progressColumns } from "@/lib/utils/progress-chart";
import { progressCellKey } from "@/lib/utils/progress-chart";
import { standingFromStreak, trailingFailStreak } from "@/lib/utils/progress-standing";

/** Three consecutive fails set CT. Fewer than three clears a CT that this rule created. */
export async function syncProgressStandings(opts: {
  enrollmentIds: number[];
  passingMark: number;
  durationWeeks: number;
}) {
  const ids = [...new Set(opts.enrollmentIds)];
  if (ids.length === 0) return;

  const columns = progressColumns(opts.durationWeeks);
  const [people, marks] = await Promise.all([
    db
      .select({
        enrollmentId: enrollments.enrollmentId,
        status: enrollments.status,
      })
      .from(enrollments)
      .where(inArray(enrollments.enrollmentId, ids)),
    db
      .select({
        enrollmentId: progressTests.enrollmentId,
        kind: progressTests.kind,
        period: progressTests.period,
        marks: progressTests.marks,
      })
      .from(progressTests)
      .where(inArray(progressTests.enrollmentId, ids)),
  ]);

  const byStudent = new Map<number, Record<string, string>>();
  for (const mark of marks) {
    if (mark.kind !== "week" && mark.kind !== "month") continue;
    const row = byStudent.get(mark.enrollmentId) ?? {};
    row[progressCellKey(mark.enrollmentId, mark.kind, mark.period)] = String(mark.marks);
    byStudent.set(mark.enrollmentId, row);
  }

  for (const person of people) {
    const scores: number[] = [];
    const row = byStudent.get(person.enrollmentId) ?? {};
    for (const column of columns) {
      const raw = row[progressCellKey(person.enrollmentId, column.kind, column.period)];
      if (raw == null || raw.trim() === "") continue;
      const value = Number(raw);
      if (Number.isFinite(value)) scores.push(value);
    }
    const standing = standingFromStreak(trailingFailStreak(scores, opts.passingMark));
    if (
      standing === "ct" &&
      (person.status === "enrolled" || person.status === "in_progress")
    ) {
      await db
        .update(enrollments)
        .set({ status: "incomplete", ceasedAt: new Date(), updatedAt: new Date() })
        .where(eq(enrollments.enrollmentId, person.enrollmentId));
    } else if (standing !== "ct" && person.status === "incomplete") {
      await db
        .update(enrollments)
        .set({ status: "in_progress", ceasedAt: null, updatedAt: new Date() })
        .where(
          and(eq(enrollments.enrollmentId, person.enrollmentId), eq(enrollments.status, "incomplete"))
        );
    }
  }
}
