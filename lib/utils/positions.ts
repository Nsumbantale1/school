import { db } from "../db";
import { enrollments, results } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { calculateGrade } from "./grades";

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
  }> = [];

  for (const enrollment of intakeEnrollments) {
    const enrollmentResults = await db
      .select({
        marksObtained: results.marksObtained,
        maxMarks: results.maxMarks,
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
    const averagePercentage =
      totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;

    enrollmentScores.push({
      enrollmentId: enrollment.enrollmentId,
      totalMarks,
      totalMaxMarks,
      averagePercentage,
      resultCount: enrollmentResults.length,
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
    const grade =
      score.resultCount > 0
        ? calculateGrade(score.totalMarks, score.totalMaxMarks)
        : null;

    // Update enrollment with calculated values
    await db
      .update(enrollments)
      .set({
        totalMarks: score.totalMarks.toFixed(2),
        averageMarks: score.averagePercentage.toFixed(2),
        grade,
        position,
        updatedAt: new Date(),
      })
      .where(eq(enrollments.enrollmentId, score.enrollmentId));

    lastAverage = score.averagePercentage;
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
  const averagePercentage =
    totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
  const grade = calculateGrade(totalMarks, totalMaxMarks);

  await db
    .update(enrollments)
    .set({
      totalMarks: totalMarks.toFixed(2),
      averageMarks: averagePercentage.toFixed(2),
      grade,
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
