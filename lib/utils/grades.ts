import type { Grade } from "../db/schema";
import { DEFAULT_PASSING_MARK } from "./passing-mark";

export type GradeInfo = {
  grade: Grade;
  label: string;
  minPercent: number;
  maxPercent: number;
  color: string;
  bgColor: string;
};

/**
 * SOFA grade scale — pass mark is 55%.
 * A: 80%+, B: 60–79%, C: 55–59%, F: below 55%.
 * D is kept for legacy records only (not assigned by calculateGrade).
 */
export const GRADE_SCALE: GradeInfo[] = [
  { grade: "A", label: "Excellent", minPercent: 80, maxPercent: 100, color: "text-green-700", bgColor: "bg-green-100" },
  { grade: "B", label: "Very Good", minPercent: 60, maxPercent: 79, color: "text-blue-700", bgColor: "bg-blue-100" },
  { grade: "C", label: "Good", minPercent: DEFAULT_PASSING_MARK, maxPercent: 59, color: "text-yellow-700", bgColor: "bg-yellow-100" },
  { grade: "D", label: "Pass (legacy)", minPercent: DEFAULT_PASSING_MARK, maxPercent: DEFAULT_PASSING_MARK, color: "text-orange-700", bgColor: "bg-orange-100" },
  { grade: "F", label: "Fail", minPercent: 0, maxPercent: DEFAULT_PASSING_MARK - 1, color: "text-red-700", bgColor: "bg-red-100" },
];

/**
 * Calculate grade based on marks obtained and maximum marks.
 * Pass mark: 55% (C). Below 55% is F.
 */
export function calculateGrade(marksObtained: number, maxMarks: number): Grade {
  if (maxMarks <= 0) return "F";

  const percentage = (marksObtained / maxMarks) * 100;
  return getGradeFromPercentage(percentage);
}

/**
 * Calculate percentage from marks
 */
export function calculatePercentage(marksObtained: number, maxMarks: number): number {
  if (maxMarks <= 0) return 0;
  return Math.round((marksObtained / maxMarks) * 100 * 100) / 100; // Round to 2 decimal places
}

/**
 * Get grade info (color, label, etc.) from a grade
 */
export function getGradeInfo(grade: Grade): GradeInfo {
  return GRADE_SCALE.find((g) => g.grade === grade) || GRADE_SCALE[4]; // Default to F
}

/**
 * Get color classes for a grade
 */
export function getGradeColor(grade: Grade): { text: string; bg: string } {
  const info = getGradeInfo(grade);
  return { text: info.color, bg: info.bgColor };
}

/**
 * Passing grades under the 55% pass mark (A / B / C).
 * Legacy D is not treated as a pass.
 */
export function isPassingGrade(grade: Grade): boolean {
  return grade === "A" || grade === "B" || grade === "C";
}

/**
 * Get grade from percentage directly
 */
export function getGradeFromPercentage(percentage: number): Grade {
  if (percentage >= 80) return "A";
  if (percentage >= 60) return "B";
  if (percentage >= DEFAULT_PASSING_MARK) return "C";
  return "F";
}
