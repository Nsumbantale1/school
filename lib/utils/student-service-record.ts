import { db } from "@/lib/db";
import {
  students,
  enrollments,
  courseIntakes,
  courses,
  results,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  checkIndisciplineBan,
  INDISCIPLINE_BAN_YEARS,
} from "./indiscipline-ban";

export interface ServiceRecordSubject {
  subjectName: string;
  marksObtained: string;
  maxMarks: string;
  grade: string | null;
  percentage: number;
  remarks: string | null;
}

export interface ServiceRecordEnrollment {
  enrollmentId: number;
  courseCode: string;
  courseName: string;
  intakeNumber: string;
  year: number;
  rankAtEnrollment: string;
  unitAtEnrollment: string | null;
  status: string;
  averageMarks: string | null;
  grade: string | null;
  position: number | null;
  ceasedAt: Date | null;
  passingMark: number;
  commanderName: string | null;
  coordinatorName: string | null;
  startDate: string;
  endDate: string | null;
  subjects: ServiceRecordSubject[];
}

export interface ServiceRecordIndisciplineIncident {
  courseCode: string;
  courseName: string;
  intakeNumber: string;
  year: number;
  ceasedAt: Date;
  eligibleAfter: Date;
  isActive: boolean;
}

export interface StudentServiceRecord {
  student: {
    armyNumber: string;
    fullName: string;
    rank: string;
    gender: string;
    dateOfBirth: string | null;
    unit: string | null;
    phone: string | null;
    email: string | null;
    isActive: boolean;
    notes: string | null;
  };
  summary: {
    totalCourses: number;
    completed: number;
    passed: number;
    failed: number;
    incomplete: number;
    indiscipline: number;
    enrolled: number;
    inProgress: number;
    withdrawn: number;
    subjectResults: number;
  };
  activeBan: Awaited<ReturnType<typeof checkIndisciplineBan>>;
  indisciplineHistory: ServiceRecordIndisciplineIncident[];
  enrollments: ServiceRecordEnrollment[];
  generatedAt: Date;
  referenceNumber: string;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

export async function getStudentServiceRecord(
  armyNumber: string
): Promise<StudentServiceRecord | null> {
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.armyNumber, armyNumber))
    .limit(1);

  if (!student) return null;

  const enrollmentRows = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      status: enrollments.status,
      rankAtEnrollment: enrollments.rankAtEnrollment,
      unitAtEnrollment: enrollments.unitAtEnrollment,
      totalMarks: enrollments.totalMarks,
      averageMarks: enrollments.averageMarks,
      grade: enrollments.grade,
      position: enrollments.position,
      ceasedAt: enrollments.ceasedAt,
      updatedAt: enrollments.updatedAt,
      createdAt: enrollments.createdAt,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      startDate: courseIntakes.startDate,
      endDate: courseIntakes.endDate,
      commanderName: courseIntakes.commanderName,
      coordinatorName: courseIntakes.coordinatorName,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      passingMark: courses.passingMark,
    })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(enrollments.studentArmyNumber, armyNumber))
    .orderBy(courseIntakes.year, courseIntakes.intakeNumber);

  const enrollmentIds = enrollmentRows.map((e) => e.enrollmentId);

  const allResults =
    enrollmentIds.length > 0
      ? await db
          .select({
            enrollmentId: results.enrollmentId,
            subjectName: results.subjectName,
            marksObtained: results.marksObtained,
            maxMarks: results.maxMarks,
            grade: results.grade,
            remarks: results.remarks,
          })
          .from(results)
          .where(inArray(results.enrollmentId, enrollmentIds))
          .orderBy(results.subjectName)
      : [];

  const resultsByEnrollment = new Map<number, ServiceRecordSubject[]>();
  for (const r of allResults) {
    const percentage =
      Number(r.maxMarks) > 0
        ? (Number(r.marksObtained) / Number(r.maxMarks)) * 100
        : 0;
    const list = resultsByEnrollment.get(r.enrollmentId) ?? [];
    list.push({
      subjectName: r.subjectName,
      marksObtained: String(r.marksObtained),
      maxMarks: String(r.maxMarks),
      grade: r.grade,
      percentage,
      remarks: r.remarks,
    });
    resultsByEnrollment.set(r.enrollmentId, list);
  }

  const enrollmentsData: ServiceRecordEnrollment[] = enrollmentRows.map(
    (e) => ({
      enrollmentId: e.enrollmentId,
      courseCode: e.courseCode,
      courseName: e.courseName,
      intakeNumber: e.intakeNumber,
      year: e.year,
      rankAtEnrollment: e.rankAtEnrollment,
      unitAtEnrollment: e.unitAtEnrollment,
      status: e.status,
      averageMarks: e.averageMarks,
      grade: e.grade,
      position: e.position,
      ceasedAt: e.ceasedAt,
      passingMark: e.passingMark,
      commanderName: e.commanderName,
      coordinatorName: e.coordinatorName,
      startDate: e.startDate,
      endDate: e.endDate,
      subjects: resultsByEnrollment.get(e.enrollmentId) ?? [],
    })
  );

  const activeBan = await checkIndisciplineBan(armyNumber);

  const indisciplineRows = enrollmentRows.filter(
    (e) => e.status === "indiscipline"
  );
  const now = new Date();
  const indisciplineHistory: ServiceRecordIndisciplineIncident[] =
    indisciplineRows.map((e) => {
      const ceasedAt = e.ceasedAt ?? e.updatedAt ?? e.createdAt;
      const eligibleAfter = addYears(ceasedAt, INDISCIPLINE_BAN_YEARS);
      return {
        courseCode: e.courseCode,
        courseName: e.courseName,
        intakeNumber: e.intakeNumber,
        year: e.year,
        ceasedAt,
        eligibleAfter,
        isActive: now < eligibleAfter,
      };
    });

  const passed = enrollmentsData.filter(
    (e) =>
      e.status === "completed" && e.grade && e.grade !== "F"
  ).length;

  const generatedAt = new Date();
  const refDate = generatedAt.toISOString().slice(0, 10).replace(/-/g, "");
  const refArmy = armyNumber.replace(/\s+/g, "");

  return {
    student: {
      armyNumber: student.armyNumber,
      fullName: student.fullName,
      rank: student.rank,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      unit: student.unit,
      phone: student.phone,
      email: student.email,
      isActive: student.isActive,
      notes: student.notes,
    },
    summary: {
      totalCourses: enrollmentsData.length,
      completed: enrollmentsData.filter((e) => e.status === "completed").length,
      passed,
      failed: enrollmentsData.filter((e) => e.status === "failed").length,
      incomplete: enrollmentsData.filter((e) => e.status === "incomplete")
        .length,
      indiscipline: enrollmentsData.filter((e) => e.status === "indiscipline")
        .length,
      enrolled: enrollmentsData.filter((e) => e.status === "enrolled").length,
      inProgress: enrollmentsData.filter((e) => e.status === "in_progress")
        .length,
      withdrawn: enrollmentsData.filter((e) => e.status === "withdrawn")
        .length,
      subjectResults: allResults.length,
    },
    activeBan,
    indisciplineHistory,
    enrollments: enrollmentsData,
    generatedAt,
    referenceNumber: `STR-${refArmy}-${refDate}`,
  };
}
