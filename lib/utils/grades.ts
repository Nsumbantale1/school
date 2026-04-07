import type { Grade } from "../db/schema";

export type GradeInfo = {
  grade: Grade;
  label: string;
  minPercent: number;
  maxPercent: number;
  color: string;
  bgColor: string;
};

export const GRADE_SCALE: GradeInfo[] = [
  { grade: "A", label: "Excellent", minPercent: 80, maxPercent: 100, color: "text-green-700", bgColor: "bg-green-100" },
  { grade: "B", label: "Very Good", minPercent: 60, maxPercent: 79, color: "text-blue-700", bgColor: "bg-blue-100" },
  { grade: "C", label: "Good", minPercent: 50, maxPercent: 59, color: "text-yellow-700", bgColor: "bg-yellow-100" },
  { grade: "D", label: "Pass", minPercent: 40, maxPercent: 49, color: "text-orange-700", bgColor: "bg-orange-100" },
  { grade: "F", label: "Fail", minPercent: 0, maxPercent: 39, color: "text-red-700", bgColor: "bg-red-100" },
];

/**
 * Calculate grade based on marks obtained and maximum marks
 * A: 80%+, B: 60-79%, C: 50-59%, D: 40-49%, F: <40%
 */
export function calculateGrade(marksObtained: number, maxMarks: number): Grade {
  if (maxMarks <= 0) return "F";

  const percentage = (marksObtained / maxMarks) * 100;

  if (percentage >= 80) return "A";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
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
 * Check if a grade is passing (D or above)
 */
export function isPassingGrade(grade: Grade): boolean {
  return grade !== "F";
}

/**
 * Get grade from percentage directly
 */
export function getGradeFromPercentage(percentage: number): Grade {
  if (percentage >= 80) return "A";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}
