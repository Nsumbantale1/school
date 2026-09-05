"use server";

import { db } from "@/lib/db";
import {
  results,
  enrollments,
  courseIntakes,
  courses,
  courseSubjects,
  students,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  requireAuth,
  canManageResults,
  canManageResultsForCourse,
} from "@/lib/auth/guards";
import { calculateGrade } from "@/lib/utils/grades";
import { recalculatePositions } from "@/lib/utils/positions";
import { parseCsv } from "@/lib/utils/csv";
import { auditCreate } from "@/lib/utils/audit";

const META_HEADERS = new Set([
  "army number",
  "army_number",
  "armynumber",
  "full name",
  "full_name",
  "name",
  "rank",
  "unit",
]);

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeArmyNumber(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

async function assertCanImportIntake(intakeId: number) {
  const user = await requireAuth();
  if (!canManageResults(user.role)) {
    return { ok: false as const, error: "Unauthorized: insufficient permissions", user };
  }

  const [intake] = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(courseIntakes.intakeId, intakeId))
    .limit(1);

  if (!intake) {
    return { ok: false as const, error: "Intake not found.", user };
  }

  if (!canManageResultsForCourse(user, intake.courseId)) {
    return {
      ok: false as const,
      error: "You can only import results for your assigned course.",
      user,
    };
  }

  return { ok: true as const, user, intake };
}

export async function importResultsFromCsv(formData: FormData) {
  const intakeId = parseInt(String(formData.get("intakeId") || ""), 10);
  const csvText = String(formData.get("csvText") || "");
  const updateExisting = formData.get("updateExisting") !== "false";

  if (!intakeId || Number.isNaN(intakeId)) {
    return { success: false, error: "Please select an intake." };
  }
  if (!csvText.trim()) {
    return { success: false, error: "CSV file is empty." };
  }

  const access = await assertCanImportIntake(intakeId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }
  const { user, intake } = access;

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      success: false,
      error: "CSV must include a header row and at least one data row.",
    };
  }

  const headers = rows[0].map((h) => h.trim());
  const normalized = headers.map(normalizeHeader);

  const armyIdx = normalized.findIndex((h) =>
    ["army number", "army_number", "armynumber"].includes(h)
  );
  if (armyIdx === -1) {
    return {
      success: false,
      error: 'Missing "Army Number" column. Download the template and try again.',
    };
  }

  // Subject catalog for this course (max marks)
  const subjectCatalog = await db
    .select({
      subjectName: courseSubjects.subjectName,
      maxMarks: courseSubjects.maxMarks,
    })
    .from(courseSubjects)
    .where(eq(courseSubjects.courseId, intake.courseId))
    .orderBy(asc(courseSubjects.sortOrder));

  const maxBySubject = new Map(
    subjectCatalog.map((s) => [s.subjectName.toLowerCase(), Number(s.maxMarks) || 100])
  );

  // Enrollments in this intake
  const intakeEnrollments = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      armyNumber: enrollments.studentArmyNumber,
    })
    .from(enrollments)
    .where(eq(enrollments.intakeId, intakeId));

  const enrollmentByArmy = new Map(
    intakeEnrollments.map((e) => [normalizeArmyNumber(e.armyNumber).toLowerCase(), e])
  );

  // Detect long format: Army Number, Subject, Marks [, Max Marks]
  const subjectColIdx = normalized.findIndex((h) =>
    ["subject", "subject name", "subject_name"].includes(h)
  );
  const marksColIdx = normalized.findIndex((h) =>
    ["marks", "marks obtained", "marks_obtained", "score"].includes(h)
  );
  const maxColIdx = normalized.findIndex((h) =>
    ["max marks", "max_marks", "maxmarks"].includes(h)
  );

  type Pending = {
    enrollmentId: number;
    armyNumber: string;
    subjectName: string;
    marksObtained: number;
    maxMarks: number;
  };

  const pending: Pending[] = [];
  const errors: string[] = [];
  let skippedEmpty = 0;

  if (subjectColIdx !== -1 && marksColIdx !== -1) {
    // Long format
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const army = normalizeArmyNumber(row[armyIdx] || "");
      const subjectName = (row[subjectColIdx] || "").trim();
      const marksRaw = (row[marksColIdx] || "").trim();
      if (!army && !subjectName && !marksRaw) continue;
      if (!army || !subjectName) {
        errors.push(`Row ${r + 1}: missing army number or subject.`);
        continue;
      }
      if (!marksRaw) {
        skippedEmpty++;
        continue;
      }
      const marksObtained = Number(marksRaw);
      if (Number.isNaN(marksObtained)) {
        errors.push(`Row ${r + 1}: invalid marks "${marksRaw}".`);
        continue;
      }
      const enrollment = enrollmentByArmy.get(army.toLowerCase());
      if (!enrollment) {
        errors.push(`Row ${r + 1}: student "${army}" is not enrolled in this intake.`);
        continue;
      }
      let maxMarks = 100;
      if (maxColIdx !== -1 && row[maxColIdx]?.trim()) {
        maxMarks = Number(row[maxColIdx]);
      } else if (maxBySubject.has(subjectName.toLowerCase())) {
        maxMarks = maxBySubject.get(subjectName.toLowerCase())!;
      }
      if (Number.isNaN(maxMarks) || maxMarks <= 0) maxMarks = 100;

      pending.push({
        enrollmentId: enrollment.enrollmentId,
        armyNumber: army,
        subjectName,
        marksObtained,
        maxMarks,
      });
    }
  } else {
    // Wide format: Army Number | Full Name | Rank | Subject1 | Subject2 | ...
    const subjectColumns = headers
      .map((h, idx) => ({ h, idx, key: normalizeHeader(h) }))
      .filter((c) => c.h && !META_HEADERS.has(c.key));

    if (subjectColumns.length === 0) {
      return {
        success: false,
        error:
          "No subject columns found. Use the downloaded template (Army Number + subject columns).",
      };
    }

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const army = normalizeArmyNumber(row[armyIdx] || "");
      if (!army) continue;

      const enrollment = enrollmentByArmy.get(army.toLowerCase());
      if (!enrollment) {
        errors.push(`Row ${r + 1}: student "${army}" is not enrolled in this intake.`);
        continue;
      }

      for (const col of subjectColumns) {
        const marksRaw = (row[col.idx] || "").trim();
        if (!marksRaw) {
          skippedEmpty++;
          continue;
        }
        const marksObtained = Number(marksRaw);
        if (Number.isNaN(marksObtained)) {
          errors.push(
            `Row ${r + 1} (${army}): invalid marks for "${col.h}" ("${marksRaw}").`
          );
          continue;
        }
        const maxMarks = maxBySubject.get(col.h.toLowerCase()) ?? 100;
        pending.push({
          enrollmentId: enrollment.enrollmentId,
          armyNumber: army,
          subjectName: col.h,
          marksObtained,
          maxMarks,
        });
      }
    }
  }

  if (pending.length === 0) {
    return {
      success: false,
      error:
        errors[0] ||
        "No marks found to import. Fill subject columns in the template and try again.",
      errors,
    };
  }

  let created = 0;
  let updated = 0;
  const touchedEnrollments = new Set<number>();

  for (const item of pending) {
    const grade = calculateGrade(item.marksObtained, item.maxMarks);

    const [existing] = await db
      .select({ resultId: results.resultId })
      .from(results)
      .where(
        and(
          eq(results.enrollmentId, item.enrollmentId),
          eq(results.subjectName, item.subjectName)
        )
      )
      .limit(1);

    if (existing) {
      if (!updateExisting) {
        errors.push(
          `${item.armyNumber} / ${item.subjectName}: already exists (skipped).`
        );
        continue;
      }
      await db
        .update(results)
        .set({
          marksObtained: item.marksObtained.toString(),
          maxMarks: item.maxMarks.toString(),
          grade,
          enteredBy: user.userId,
          updatedAt: new Date(),
        })
        .where(eq(results.resultId, existing.resultId));
      updated++;
    } else {
      await db.insert(results).values({
        enrollmentId: item.enrollmentId,
        subjectName: item.subjectName,
        marksObtained: item.marksObtained.toString(),
        maxMarks: item.maxMarks.toString(),
        grade,
        enteredBy: user.userId,
      });
      created++;
    }

    touchedEnrollments.add(item.enrollmentId);
  }

  // Recalculate averages + positions once for the intake
  await recalculatePositions(intakeId);

  await auditCreate(user, "results", `import-intake-${intakeId}`, {
    intakeId,
    created,
    updated,
    skippedEmpty,
    errorCount: errors.length,
  });

  revalidatePath("/results");
  revalidatePath(`/intakes/${intakeId}`);
  revalidatePath(`/courses/${intake.courseId}`);
  for (const enrollmentId of touchedEnrollments) {
    revalidatePath(`/enrollments/${enrollmentId}`);
  }

  return {
    success: true,
    created,
    updated,
    skippedEmpty,
    errors: errors.slice(0, 50),
    errorCount: errors.length,
    message: `Imported ${created + updated} mark(s): ${created} new, ${updated} updated.`,
  };
}

/** Data needed to build a CSV template on the client / server. */
export async function getImportTemplateData(intakeId: number) {
  const access = await assertCanImportIntake(intakeId);
  if (!access.ok) {
    return { success: false as const, error: access.error };
  }
  const { intake } = access;

  let subjects = await db
    .select({
      subjectName: courseSubjects.subjectName,
      maxMarks: courseSubjects.maxMarks,
    })
    .from(courseSubjects)
    .where(eq(courseSubjects.courseId, intake.courseId))
    .orderBy(asc(courseSubjects.sortOrder));

  // Fallback: subjects already used in this intake's results
  if (subjects.length === 0) {
    const fromResults = await db
      .selectDistinct({ subjectName: results.subjectName })
      .from(results)
      .innerJoin(enrollments, eq(results.enrollmentId, enrollments.enrollmentId))
      .where(eq(enrollments.intakeId, intakeId));

    subjects = fromResults
      .map((r) => ({
        subjectName: r.subjectName,
        maxMarks: "100",
      }))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }

  const roster = await db
    .select({
      armyNumber: students.armyNumber,
      fullName: students.fullName,
      rank: enrollments.rankAtEnrollment,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .where(eq(enrollments.intakeId, intakeId))
    .orderBy(asc(students.fullName));

  return {
    success: true as const,
    intake,
    subjects: subjects.map((s) => ({
      subjectName: s.subjectName,
      maxMarks: String(s.maxMarks ?? "100"),
    })),
    roster,
  };
}

/** Import an official SOFA workbook (one file, many student report sheets). */
export async function importOfficialSofaWorkbook(formData: FormData) {
  // Admin-only: workbook import can create/overwrite students across courses.
  const user = await requireAuth();
  if (user.role !== "admin") {
    return {
      success: false as const,
      error: "Unauthorized: only administrators can import official SOFA workbooks.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false as const, error: "Please choose an Excel (.xlsx) workbook." };
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return { success: false as const, error: "Upload an official SOFA Excel workbook (.xlsx)." };
  }

  try {
    const { importSofaWorkbookFromBuffer } = await import("@/lib/utils/sofa-import");
    const buffer = Buffer.from(await file.arrayBuffer());
    const summary = await importSofaWorkbookFromBuffer(buffer, file.name, user.userId);

    await auditCreate(user, "results", `sofa-import-${summary.intakeId}`, {
      filename: summary.filename,
      courseCode: summary.courseCode,
      intakeNumber: summary.intakeNumber,
      students: summary.students,
      results: summary.results,
    });

    revalidatePath("/results");
    revalidatePath("/students");
    revalidatePath("/enrollments");
    revalidatePath("/courses");
    revalidatePath("/intakes");
    revalidatePath(`/intakes/${summary.intakeId}`);
    revalidatePath(`/courses/${summary.courseId}`);

    return {
      success: true as const,
      ...summary,
      message: `Imported ${summary.courseCode} intake ${summary.intakeNumber}: ${summary.students} students, ${summary.results} results.`,
    };
  } catch (error) {
    return {
      success: false as const,
      error: (error as Error).message || "Failed to import workbook.",
    };
  }
}
