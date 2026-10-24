"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { courseIntakes, courses, enrollments, progressTests, students } from "@/lib/db/schema";
import { requireAuth, canManageResultsForCourse } from "@/lib/auth/guards";
import { ensureProgressTestsTable } from "@/lib/db/ensure-progress-tests";
import type { ProgressKind } from "@/lib/utils/progress-chart";
import { armyMatchKey, parseProgressGrid } from "@/lib/utils/progress-excel";
import { openProgressAuthority } from "@/lib/utils/progress-authority";
import { syncProgressStandings } from "@/lib/utils/sync-progress-standing";

export async function saveProgressMark(input: {
  intakeId: number;
  enrollmentId: number;
  kind: ProgressKind;
  period: number;
  marks: string;
}) {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "instructor") {
    return { success: false, error: "You cannot enter these marks." };
  }
  if (input.kind !== "week" && input.kind !== "month") {
    return { success: false, error: "Unknown test type." };
  }
  if (!Number.isInteger(input.period) || input.period < 1 || input.period > 52) {
    return { success: false, error: "That week or month is not valid." };
  }

  const [enrollment] = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      courseId: courseIntakes.courseId,
      intakeId: enrollments.intakeId,
      passingMark: courses.passingMark,
      durationWeeks: courses.durationWeeks,
    })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(enrollments.enrollmentId, input.enrollmentId))
    .limit(1);

  if (!enrollment || enrollment.intakeId !== input.intakeId) {
    return { success: false, error: "Student is not on this intake." };
  }
  if (
    user.role === "instructor" &&
    !canManageResultsForCourse(user, enrollment.courseId)
  ) {
    return { success: false, error: "You can only enter marks for your course." };
  }

  const raw = input.marks.trim();
  const [existingMark] = await db
    .select({ marks: progressTests.marks })
    .from(progressTests)
    .where(
      and(
        eq(progressTests.enrollmentId, input.enrollmentId),
        eq(progressTests.kind, input.kind),
        eq(progressTests.period, input.period)
      )
    )
    .limit(1);
  if (user.role === "instructor" && existingMark) {
    const unchanged =
      raw !== "" && Math.abs(Number(existingMark.marks) - Number(raw)) < 0.001;
    const granted = await openProgressAuthority(input.intakeId, user.userId);
    if (!unchanged && !granted) {
      return {
        success: false,
        error:
          "This mark is already recorded. Ask the Chief Instructor for authority before changing it.",
      };
    }
  }

  if (raw === "") {
    await db
      .delete(progressTests)
      .where(
        and(
          eq(progressTests.enrollmentId, input.enrollmentId),
          eq(progressTests.kind, input.kind),
          eq(progressTests.period, input.period)
        )
      );
    revalidatePath(`/weekly/${input.intakeId}`);
    revalidatePath(`/intakes/${input.intakeId}`);
    await syncProgressStandings({
      enrollmentIds: [input.enrollmentId],
      passingMark: enrollment.passingMark,
      durationWeeks: enrollment.durationWeeks,
    });
    return { success: true };
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return { success: false, error: "Enter a mark from 0 to 100." };
  }

  const marks = value.toFixed(2);
  await db
    .insert(progressTests)
    .values({
      enrollmentId: input.enrollmentId,
      kind: input.kind,
      period: input.period,
      marks,
      updatedBy: user.userId,
    })
    .onConflictDoUpdate({
      target: [
        progressTests.enrollmentId,
        progressTests.kind,
        progressTests.period,
      ],
      set: {
        marks,
        updatedBy: user.userId,
        updatedAt: new Date(),
      },
    });

  revalidatePath(`/weekly/${input.intakeId}`);
  revalidatePath(`/intakes/${input.intakeId}`);
  await syncProgressStandings({
    enrollmentIds: [input.enrollmentId],
    passingMark: enrollment.passingMark,
    durationWeeks: enrollment.durationWeeks,
  });
  return { success: true };
}

export async function importProgressWorkbook(intakeId: number, formData: FormData) {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "instructor") {
    return { success: false as const, error: "You cannot enter these marks." };
  }

  const [intake] = await db
    .select({
      courseId: courseIntakes.courseId,
      passingMark: courses.passingMark,
      durationWeeks: courses.durationWeeks,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);
  if (!intake) return { success: false as const, error: "Intake not found." };
  if (user.role === "instructor" && !canManageResultsForCourse(user, intake.courseId)) {
    return { success: false as const, error: "You can only enter marks for your course." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false as const, error: "Choose an Excel or PDF file." };
  }
  if (file.size > 5_000_000) {
    return { success: false as const, error: "The file is larger than 5 MB." };
  }

  const filename = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let rows: string[][];
  if (filename.endsWith(".pdf")) {
    const { extractPdfGrid } = await import("@/lib/utils/roster-parse");
    rows = await extractPdfGrid(bytes);
  } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
    if (!sheet) return { success: false as const, error: "The workbook has no sheet." };
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    rows = grid.map((row) =>
      (Array.isArray(row) ? row : []).map((cell) => (cell == null ? "" : String(cell).trim()))
    );
  } else {
    return { success: false as const, error: "Upload an Excel file (.xlsx, .xls) or a PDF." };
  }
  const parsed = parseProgressGrid(rows);
  if (parsed.cells.length === 0) {
    const scan =
      filename.endsWith(".pdf")
        ? " If this PDF is a scanned image, upload the Excel file instead."
        : "";
    return {
      success: false as const,
      error: `${parsed.errors[0] ?? "No marks were found."}${scan}`,
    };
  }

  const roster = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      armyNumber: students.armyNumber,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .where(eq(enrollments.intakeId, intakeId));
  const byArmy = new Map(roster.map((row) => [armyMatchKey(row.armyNumber), row.enrollmentId]));
  const recorded = await db
    .select({
      enrollmentId: progressTests.enrollmentId,
      kind: progressTests.kind,
      period: progressTests.period,
      marks: progressTests.marks,
    })
    .from(progressTests)
    .innerJoin(enrollments, eq(progressTests.enrollmentId, enrollments.enrollmentId))
    .where(eq(enrollments.intakeId, intakeId));
  const recordedMarks = new Map(
    recorded.map((row) => [
      `${row.enrollmentId}:${row.kind}:${row.period}`,
      Number(row.marks),
    ])
  );
  const mayRevise =
    user.role === "admin" ||
    (user.role === "instructor" && !!(await openProgressAuthority(intakeId, user.userId)));

  const values: {
    enrollmentId: number;
    kind: ProgressKind;
    period: number;
    marks: string;
    updatedBy: number;
  }[] = [];
  const missing = new Set<string>();
  let blocked = 0;
  for (const cell of parsed.cells) {
    const enrollmentId = byArmy.get(cell.armyKey);
    if (!enrollmentId) {
      missing.add(cell.armyNumber);
      continue;
    }
    const previous = recordedMarks.get(`${enrollmentId}:${cell.kind}:${cell.period}`);
    if (previous != null) {
      if (Math.abs(previous - cell.marks) < 0.001) continue;
      if (!mayRevise) {
        blocked += 1;
        continue;
      }
    }
    values.push({
      enrollmentId,
      kind: cell.kind,
      period: cell.period,
      marks: cell.marks.toFixed(2),
      updatedBy: user.userId,
    });
  }
  if (values.length === 0) {
    if (blocked > 0) {
      return {
        success: false as const,
        error:
          "Those marks are already recorded. Ask the Chief Instructor for authority before changing them.",
      };
    }
    if (missing.size === 0) {
      return { success: true as const, message: "Those marks were already on the chart." };
    }
    return {
      success: false as const,
      error: "None of the army numbers in the file are on this intake.",
    };
  }

  await ensureProgressTestsTable();
  const unique = new Map<string, (typeof values)[number]>();
  for (const value of values) {
    unique.set(`${value.enrollmentId}:${value.kind}:${value.period}`, value);
  }
  const batch = [...unique.values()];
  await db
    .insert(progressTests)
    .values(batch)
    .onConflictDoUpdate({
      target: [progressTests.enrollmentId, progressTests.kind, progressTests.period],
      set: {
        marks: sql`excluded.marks`,
        updatedBy: user.userId,
        updatedAt: new Date(),
      },
    });

  await syncProgressStandings({
    enrollmentIds: batch.map((row) => row.enrollmentId),
    passingMark: intake.passingMark,
    durationWeeks: intake.durationWeeks,
  });

  revalidatePath(`/weekly/${intakeId}`);
  revalidatePath(`/intakes/${intakeId}`);
  revalidatePath(`/weekly/course/${intake.courseId}`);
  revalidatePath(`/courses/${intake.courseId}`);
  const skipped = missing.size
    ? ` ${missing.size} army number${missing.size === 1 ? "" : "s"} were not on this intake.`
    : "";
  const kept = blocked
    ? ` ${blocked} recorded mark${blocked === 1 ? "" : "s"} were left unchanged. Ask the Chief Instructor for authority to edit them.`
    : "";
  const warnings = parsed.errors.length ? ` ${parsed.errors.length} cell${parsed.errors.length === 1 ? "" : "s"} were skipped.` : "";
  return {
    success: true as const,
    message: `Added ${batch.length} mark${batch.length === 1 ? "" : "s"} to this chart. Earlier weeks left blank in the file were kept.${skipped}${kept}${warnings}`,
  };
}
