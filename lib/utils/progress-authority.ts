import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  courseIntakes,
  courses,
  enrollments,
  progressEditAuthorities,
  progressTests,
  users,
} from "@/lib/db/schema";
import { ensureProgressAuthoritiesTable } from "@/lib/db/ensure-progress-authorities";
import { ensureProgressTestsTable } from "@/lib/db/ensure-progress-tests";

export async function intakeHasRecordedMarks(intakeId: number): Promise<boolean> {
  await ensureProgressTestsTable();
  const [row] = await db
    .select({ id: progressTests.id })
    .from(progressTests)
    .innerJoin(enrollments, eq(progressTests.enrollmentId, enrollments.enrollmentId))
    .where(eq(enrollments.intakeId, intakeId))
    .limit(1);
  return !!row;
}

export async function openProgressAuthority(intakeId: number, userId: number) {
  await ensureProgressAuthoritiesTable();
  const [row] = await db
    .select({
      id: progressEditAuthorities.id,
      status: progressEditAuthorities.status,
      reason: progressEditAuthorities.reason,
    })
    .from(progressEditAuthorities)
    .where(
      and(
        eq(progressEditAuthorities.intakeId, intakeId),
        eq(progressEditAuthorities.requestedBy, userId),
        eq(progressEditAuthorities.status, "granted")
      )
    )
    .orderBy(desc(progressEditAuthorities.id))
    .limit(1);
  return row ?? null;
}

export async function pendingProgressAuthority(intakeId: number, userId: number) {
  await ensureProgressAuthoritiesTable();
  const [row] = await db
    .select({
      id: progressEditAuthorities.id,
      reason: progressEditAuthorities.reason,
    })
    .from(progressEditAuthorities)
    .where(
      and(
        eq(progressEditAuthorities.intakeId, intakeId),
        eq(progressEditAuthorities.requestedBy, userId),
        eq(progressEditAuthorities.status, "pending")
      )
    )
    .limit(1);
  return row ?? null;
}

export async function listPendingProgressAuthorities() {
  await ensureProgressAuthoritiesTable();
  return db
    .select({
      id: progressEditAuthorities.id,
      reason: progressEditAuthorities.reason,
      createdAt: progressEditAuthorities.createdAt,
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      courseCode: courses.courseCode,
      requestedByName: users.name,
    })
    .from(progressEditAuthorities)
    .innerJoin(courseIntakes, eq(progressEditAuthorities.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .innerJoin(users, eq(progressEditAuthorities.requestedBy, users.id))
    .where(eq(progressEditAuthorities.status, "pending"))
    .orderBy(desc(progressEditAuthorities.createdAt));
}
