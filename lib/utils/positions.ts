import { db } from "../db";
import { enrollments, results } from "../db/schema";
import { eq } from "drizzle-orm";
import { calculateGrade, getGradeFromPercentage } from "./grades";
import { parseBccRemarks, tpdfGradeToSystem } from "./bcc-report";
import type { Grade } from "../db/schema";
import { DEFAULT_PASSING_MARK } from "./passing-mark";
import { academicStatusFromAverage } from "./enrollment-status";

/**
 * Recalculate positions for all students in an intake based on their average marks.
 * Students with higher averages get better (lower) positions.
 * Students with the same average share the same position.
 */
export async function recalculatePositions(intakeId: number): Promise<void> {
  // Get all enrollments for this intake with their results
  const intakeEnrollments = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      studentArmyNumber: enrollments.studentArmyNumber,
      status: enrollments.status,
    })
    .from(enrollments)
    .where(eq(enrollments.intakeId, intakeId));

  if (intakeEnrollments.length === 0) return;

  // Calculate totals for each enrollment
  const enrollmentScores: Array<{
    enrollmentId: number;
    totalMarks: number;
    totalMaxMarks: number;
    averagePercentage: number;
    resultCount: number;
    bccGrade: Grade | null;
  }> = [];

  for (const enrollment of intakeEnrollments) {
    const enrollmentResults = await db
      .select({
        marksObtained: results.marksObtained,
        maxMarks: results.maxMarks,
        remarks: results.remarks,
      })
      .from(results)
      .where(eq(results.enrollmentId, enrollment.enrollmentId));

    if (enrollmentResults.length === 0) {
      enrollmentScores.push({
        enrollmentId: enrollment.enrollmentId,
        totalMarks: 0,
        totalMaxMarks: 0,
        averagePercentage: 0,
        resultCount: 0,
        bccGrade: null,
      });
      continue;
    }

    const totalMarks = enrollmentResults.reduce(
      (sum, r) => sum + parseFloat(r.marksObtained),
      0
    );
    const totalMaxMarks = enrollmentResults.reduce(
      (sum, r) => sum + parseFloat(r.maxMarks),
      0
    );
    // bcc6 tabular sheets store weighted subject marks that already sum to ~TOTAL/100.
    // Cohort-max "max_marks" must NOT be used as the denominator (it invents false fails).
    const bcc6Tabular = enrollmentResults.some((r) =>
      (r.remarks ?? "").startsWith("bcc6:")
    );
    const averagePercentage = bcc6Tabular
      ? totalMarks
      : totalMaxMarks > 0
        ? (totalMarks / totalMaxMarks) * 100
        : 0;

    enrollmentScores.push({
      enrollmentId: enrollment.enrollmentId,
      totalMarks,
      totalMaxMarks,
      averagePercentage,
      resultCount: enrollmentResults.length,
      bccGrade: sofaGradeFromResults(enrollmentResults),
    });
  }

  // Sort by average percentage (descending)
  enrollmentScores.sort((a, b) => b.averagePercentage - a.averagePercentage);

  // Assign positions (same average = same position)
  let currentPosition = 1;
  let lastAverage: number | null = null;
  let skipCount = 0;

  for (let i = 0; i < enrollmentScores.length; i++) {
    const score = enrollmentScores[i];

    if (lastAverage !== null && score.averagePercentage !== lastAverage) {
      currentPosition += skipCount;
      skipCount = 1;
    } else {
      skipCount++;
    }

    // Only assign position if student has at least one result
    const position = score.resultCount > 0 ? currentPosition : null;

    // Calculate overall grade based on average
    const grade: Grade | null =
      score.resultCount > 0
        ? score.bccGrade ?? getGradeFromPercentage(score.averagePercentage)
        : null;

    const academicStatus =
      score.resultCount > 0
        ? grade != null && grade !== "F"
          ? "completed"
          : grade === "F"
            ? "incomplete"
            : academicStatusFromAverage(
                score.averagePercentage,
                DEFAULT_PASSING_MARK
              )
        : null;

    const current = intakeEnrollments.find(
      (e) => e.enrollmentId === score.enrollmentId
    );
    const protectStatus =
      current?.status === "indiscipline" || current?.status === "withdrawn";

    // Update enrollment with calculated values
    await db
      .update(enrollments)
      .set({
        totalMarks: score.totalMarks.toFixed(2),
        averageMarks: score.averagePercentage.toFixed(2),
        grade,
        position,
        ...(!protectStatus && academicStatus
          ? {
              status: academicStatus,
              ...(academicStatus === "incomplete"
                ? { ceasedAt: new Date() }
                : {}),
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(enrollments.enrollmentId, score.enrollmentId));

    lastAverage = score.averagePercentage;
  }
}

/**
 * Rank positions from the *stored* averageMarks only.
 * Does not recompute totals from subject rows (preserves Excel TOTAL).
 * Higher average → better (lower) position; ties share the same position.
 */
export async function rankPositionsFromStoredAverages(
  intakeId: number
): Promise<void> {
  const rows = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      averageMarks: enrollments.averageMarks,
      status: enrollments.status,
    })
    .from(enrollments)
    .where(eq(enrollments.intakeId, intakeId));

  if (rows.length === 0) return;

  const ranked = rows
    .map((r) => ({
      enrollmentId: r.enrollmentId,
      status: r.status,
      avg:
        r.averageMarks != null && r.averageMarks !== ""
          ? parseFloat(String(r.averageMarks))
          : NaN,
    }))
    .sort((a, b) => {
      const aOk = Number.isFinite(a.avg);
      const bOk = Number.isFinite(b.avg);
      if (aOk && bOk) return b.avg - a.avg;
      if (aOk) return -1;
      if (bOk) return 1;
      return 0;
    });

  let pos = 1;
  let lastAvg: number | null = null;
  let skip = 0;

  for (const row of ranked) {
    if (!Number.isFinite(row.avg)) {
      await db
        .update(enrollments)
        .set({ position: null, updatedAt: new Date() })
        .where(eq(enrollments.enrollmentId, row.enrollmentId));
      continue;
    }

    if (lastAvg !== null && row.avg !== lastAvg) {
      pos += skip;
      skip = 1;
    } else {
      skip += 1;
    }

    await db
      .update(enrollments)
      .set({ position: pos, updatedAt: new Date() })
      .where(eq(enrollments.enrollmentId, row.enrollmentId));

    lastAvg = row.avg;
  }
}

/**
 * Recalculate a single enrollment's marks and grade (but not position).
 * Call recalculatePositions() after to update positions for all students.
 */
export async function recalculateEnrollmentMarks(
  enrollmentId: number
): Promise<{ totalMarks: number; averageMarks: number; grade: string | null }> {
  const enrollmentResults = await db
    .select({
      marksObtained: results.marksObtained,
      maxMarks: results.maxMarks,
      remarks: results.remarks,
    })
    .from(results)
    .where(eq(results.enrollmentId, enrollmentId));

  if (enrollmentResults.length === 0) {
    await db
      .update(enrollments)
      .set({
        totalMarks: null,
        averageMarks: null,
        grade: null,
        updatedAt: new Date(),
      })
      .where(eq(enrollments.enrollmentId, enrollmentId));

    return { totalMarks: 0, averageMarks: 0, grade: null };
  }

  const totalMarks = enrollmentResults.reduce(
    (sum, r) => sum + parseFloat(r.marksObtained),
    0
  );
  const totalMaxMarks = enrollmentResults.reduce(
    (sum, r) => sum + parseFloat(r.maxMarks),
    0
  );
  const bcc6Tabular = enrollmentResults.some((r) =>
    (r.remarks ?? "").startsWith("bcc6:")
  );
  const averagePercentage = bcc6Tabular
    ? totalMarks
    : totalMaxMarks > 0
      ? (totalMarks / totalMaxMarks) * 100
      : 0;

  const grade =
    sofaGradeFromResults(enrollmentResults) ??
    (bcc6Tabular
      ? getGradeFromPercentage(averagePercentage)
      : calculateGrade(totalMarks, totalMaxMarks));

  const academicStatus = academicStatusFromAverage(
    averagePercentage,
    DEFAULT_PASSING_MARK
  );

  const [existing] = await db
    .select({ status: enrollments.status })
    .from(enrollments)
    .where(eq(enrollments.enrollmentId, enrollmentId))
    .limit(1);
  const protectStatus =
    existing?.status === "indiscipline" || existing?.status === "withdrawn";

  await db
    .update(enrollments)
    .set({
      totalMarks: totalMarks.toFixed(2),
      averageMarks: averagePercentage.toFixed(2),
      grade,
      ...(!protectStatus && academicStatus
        ? {
            status: academicStatus,
            ...(academicStatus === "incomplete" ? { ceasedAt: new Date() } : {}),
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(enrollments.enrollmentId, enrollmentId));

  return { totalMarks, averageMarks: averagePercentage, grade };
}

/**
 * Get intake ID for an enrollment
 */
export async function getIntakeIdForEnrollment(
  enrollmentId: number
): Promise<number | null> {
  const result = await db
    .select({ intakeId: enrollments.intakeId })
    .from(enrollments)
    .where(eq(enrollments.enrollmentId, enrollmentId))
    .limit(1);

  return result[0]?.intakeId ?? null;
}

function sofaGradeFromResults(
  rows: Array<{ remarks: string | null }>
): Grade | null {
  for (const row of rows) {
    const meta = parseBccRemarks(row.remarks);
    if (meta?.courseGrade) return tpdfGradeToSystem(meta.courseGrade);
  }
  return null;
}
