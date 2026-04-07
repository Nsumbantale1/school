import { db } from "../db";
import {
  coursePrerequisites,
  enrollments,
  courseIntakes,
  courses,
} from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface PrerequisiteCheck {
  eligible: boolean;
  missingPrerequisites: Array<{
    courseId: number;
    courseCode: string;
    courseName: string;
    isOptional: boolean;
  }>;
  completedPrerequisites: Array<{
    courseId: number;
    courseCode: string;
    courseName: string;
  }>;
  message: string;
}

/**
 * Check if a student meets the prerequisites for a course
 */
export async function checkPrerequisites(
  studentArmyNumber: string,
  courseId: number
): Promise<PrerequisiteCheck> {
  // Get all prerequisites for the course
  const prerequisites = await db
    .select({
      prerequisiteCourseId: coursePrerequisites.prerequisiteCourseId,
      isOptional: coursePrerequisites.isOptional,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(coursePrerequisites)
    .innerJoin(
      courses,
      eq(coursePrerequisites.prerequisiteCourseId, courses.courseId)
    )
    .where(eq(coursePrerequisites.courseId, courseId));

  // No prerequisites - student is eligible
  if (prerequisites.length === 0) {
    return {
      eligible: true,
      missingPrerequisites: [],
      completedPrerequisites: [],
      message: "No prerequisites required for this course.",
    };
  }

  // Get all courses the student has completed
  const completedEnrollments = await db
    .select({
      courseId: courseIntakes.courseId,
    })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .where(
      and(
        eq(enrollments.studentArmyNumber, studentArmyNumber),
        eq(enrollments.status, "completed")
      )
    );

  const completedCourseIds = completedEnrollments.map((e) => e.courseId);

  // Separate required and optional prerequisites
  const requiredPrereqs = prerequisites.filter((p) => !p.isOptional);
  const optionalPrereqs = prerequisites.filter((p) => p.isOptional);

  // Check required prerequisites
  const missingRequired = requiredPrereqs.filter(
    (p) => !completedCourseIds.includes(p.prerequisiteCourseId)
  );

  // Check optional prerequisites (need at least one if there are any)
  const completedOptional = optionalPrereqs.filter((p) =>
    completedCourseIds.includes(p.prerequisiteCourseId)
  );
  const needsOptional =
    optionalPrereqs.length > 0 && completedOptional.length === 0;

  // Build results
  const completedPrerequisites = prerequisites
    .filter((p) => completedCourseIds.includes(p.prerequisiteCourseId))
    .map((p) => ({
      courseId: p.prerequisiteCourseId,
      courseCode: p.courseCode,
      courseName: p.courseName,
    }));

  const missingPrerequisites = prerequisites
    .filter((p) => !completedCourseIds.includes(p.prerequisiteCourseId))
    .map((p) => ({
      courseId: p.prerequisiteCourseId,
      courseCode: p.courseCode,
      courseName: p.courseName,
      isOptional: p.isOptional,
    }));

  // Determine eligibility
  const eligible = missingRequired.length === 0 && !needsOptional;

  // Build message
  let message = "";
  if (eligible) {
    message = "Student meets all prerequisites.";
  } else {
    const messages: string[] = [];
    if (missingRequired.length > 0) {
      messages.push(
        `Missing required: ${missingRequired.map((p) => p.courseCode).join(", ")}`
      );
    }
    if (needsOptional) {
      messages.push(
        `Must complete at least one of: ${optionalPrereqs.map((p) => p.courseCode).join(", ")}`
      );
    }
    message = messages.join(". ");
  }

  return {
    eligible,
    missingPrerequisites,
    completedPrerequisites,
    message,
  };
}

/**
 * Get all prerequisites for a course (for display purposes)
 */
export async function getCoursePrerequisites(
  courseId: number
): Promise<
  Array<{
    courseId: number;
    courseCode: string;
    courseName: string;
    isOptional: boolean;
  }>
> {
  const prerequisites = await db
    .select({
      courseId: coursePrerequisites.prerequisiteCourseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      isOptional: coursePrerequisites.isOptional,
    })
    .from(coursePrerequisites)
    .innerJoin(
      courses,
      eq(coursePrerequisites.prerequisiteCourseId, courses.courseId)
    )
    .where(eq(coursePrerequisites.courseId, courseId));

  return prerequisites;
}

/**
 * Get courses that require this course as a prerequisite
 */
export async function getCoursesRequiringPrerequisite(
  courseId: number
): Promise<
  Array<{
    courseId: number;
    courseCode: string;
    courseName: string;
  }>
> {
  const dependentCourses = await db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(coursePrerequisites)
    .innerJoin(courses, eq(coursePrerequisites.courseId, courses.courseId))
    .where(eq(coursePrerequisites.prerequisiteCourseId, courseId));

  return dependentCourses;
}
