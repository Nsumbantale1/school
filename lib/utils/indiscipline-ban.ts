import { db } from "@/lib/db";
import { enrollments, courseIntakes, courses } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const INDISCIPLINE_BAN_YEARS = 3;

const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export interface IndisciplineBanCheck {
  blocked: boolean;
  message: string;
  incident?: {
    courseCode: string;
    courseName: string;
    intakeNumber: string;
    year: number;
    month: string;
    ceasedAt: Date;
    eligibleAfter: Date;
  };
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function formatEnglishDate(date: Date): string {
  const month = ENGLISH_MONTHS[date.getMonth()];
  return `${month} ${date.getFullYear()}`;
}

/**
 * Returns true if the student is still within the 3-year indiscipline ban.
 */
export async function checkIndisciplineBan(
  studentArmyNumber: string
): Promise<IndisciplineBanCheck> {
  const incidents = await db
    .select({
      ceasedAt: enrollments.ceasedAt,
      updatedAt: enrollments.updatedAt,
      createdAt: enrollments.createdAt,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      year: courseIntakes.year,
      intakeNumber: courseIntakes.intakeNumber,
    })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(
      and(
        eq(enrollments.studentArmyNumber, studentArmyNumber),
        eq(enrollments.status, "indiscipline")
      )
    )
    .orderBy(desc(enrollments.ceasedAt), desc(enrollments.updatedAt));

  const now = new Date();

  for (const incident of incidents) {
    const ceasedAt =
      incident.ceasedAt ?? incident.updatedAt ?? incident.createdAt;
    const eligibleAfter = addYears(ceasedAt, INDISCIPLINE_BAN_YEARS);

    if (now < eligibleAfter) {
      const month = ENGLISH_MONTHS[ceasedAt.getMonth()];

      return {
        blocked: true,
        message:
          `This student cannot be enrolled. They ceased training due to an indiscipline case in ` +
          `${incident.courseCode} (${incident.courseName}), intake ${incident.intakeNumber}, ` +
          `year ${incident.year}, ${month}. ` +
          `They may enroll again after ${formatEnglishDate(eligibleAfter)}.`,
        incident: {
          courseCode: incident.courseCode,
          courseName: incident.courseName,
          intakeNumber: incident.intakeNumber,
          year: incident.year,
          month,
          ceasedAt,
          eligibleAfter,
        },
      };
    }
  }

  return { blocked: false, message: "" };
}
