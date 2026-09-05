import { db } from "@/lib/db";
import {
  students,
  courses,
  courseIntakes,
  enrollments,
  results,
  courseSubjects,
  courseNotices,
} from "@/lib/db/schema";
import { and, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import type { SessionUser } from "@/lib/auth";
import { studentPath } from "@/lib/utils";
import { matchKnowledge, type KnowledgeEntry } from "./knowledge";

export interface AssistantReference {
  label: string;
  href: string;
  detail?: string;
}

export interface AssistantResponse {
  answer: string;
  references: AssistantReference[];
  offline: true;
  source: "database" | "knowledge" | "mixed" | "help";
}

function refsFromKnowledge(entries: KnowledgeEntry[]): AssistantReference[] {
  return entries.map((e) => ({
    label: e.locationLabel,
    href: e.href,
    detail: e.title,
  }));
}

function helpText(): AssistantResponse {
  return {
    offline: true,
    source: "help",
    answer: [
      "I am the SOFA Offline Assistant. I only use this PC’s database and built-in system guide — no internet AI.",
      "",
      "You can ask things like:",
      "• Find student SN-1001 / John",
      "• How do I import BCC results?",
      "• Where do I print a certificate?",
      "• Show course BCC",
      "• How many students are enrolled?",
      "• Where are course notices?",
      "",
      "Every answer includes Where to open it in the system (sidebar path + link).",
    ].join("\n"),
    references: [
      { label: "Sidebar → Dashboard", href: "/dashboard" },
      { label: "Sidebar → Students", href: "/students" },
      { label: "Sidebar → Results → Import", href: "/results/import" },
      { label: "Sidebar → Course Notices", href: "/course-notices" },
    ],
  };
}

async function searchStudents(q: string): Promise<AssistantReference[]> {
  const pattern = `%${q}%`;
  const rows = await db
    .select({
      armyNumber: students.armyNumber,
      fullName: students.fullName,
      rank: students.rank,
      unit: students.unit,
    })
    .from(students)
    .where(
      and(
        eq(students.isActive, true),
        or(
          ilike(students.armyNumber, pattern),
          ilike(students.fullName, pattern),
          ilike(students.rank, pattern)
        )
      )
    )
    .limit(8);

  return rows.map((s) => ({
    label: `${s.rank} ${s.fullName}`,
    href: studentPath(s.armyNumber),
    detail: `${s.armyNumber}${s.unit ? ` · ${s.unit}` : ""}`,
  }));
}

async function searchCourses(q: string) {
  const pattern = `%${q}%`;
  return db
    .select({
      courseId: courses.courseId,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      durationWeeks: courses.durationWeeks,
    })
    .from(courses)
    .where(
      and(
        eq(courses.isActive, true),
        or(ilike(courses.courseCode, pattern), ilike(courses.courseName, pattern))
      )
    )
    .limit(6);
}

async function searchIntakes(q: string) {
  const pattern = `%${q}%`;
  return db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      courseCode: courses.courseCode,
      courseId: courses.courseId,
    })
    .from(courseIntakes)
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(
      or(
        ilike(courseIntakes.intakeNumber, pattern),
        ilike(courses.courseCode, pattern),
        ilike(courses.courseName, pattern)
      )
    )
    .orderBy(desc(courseIntakes.year))
    .limit(6);
}

async function studentDetail(armyOrName: string): Promise<AssistantResponse | null> {
  const pattern = `%${armyOrName}%`;
  const [student] = await db
    .select()
    .from(students)
    .where(
      or(
        ilike(students.armyNumber, pattern),
        ilike(students.fullName, pattern)
      )
    )
    .limit(1);

  if (!student) return null;

  const enrs = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      status: enrollments.status,
      grade: enrollments.grade,
      averageMarks: enrollments.averageMarks,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
    })
    .from(enrollments)
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(eq(enrollments.studentArmyNumber, student.armyNumber))
    .orderBy(desc(courseIntakes.year))
    .limit(10);

  const lines = [
    `Student: ${student.rank} ${student.fullName}`,
    `Army Number: ${student.armyNumber}`,
    student.unit ? `Unit: ${student.unit}` : null,
    student.phone ? `Phone: ${student.phone}` : null,
    "",
    enrs.length
      ? `Enrollments (${enrs.length} shown):`
      : "No enrollments found for this student.",
    ...enrs.map(
      (e) =>
        `• ${e.courseCode} ${e.intakeNumber} (${e.year}) — ${e.status}${
          e.grade ? `, grade ${e.grade}` : ""
        }${e.averageMarks ? `, avg ${e.averageMarks}` : ""}`
    ),
  ].filter(Boolean) as string[];

  const references: AssistantReference[] = [
    {
      label: "Student profile",
      href: studentPath(student.armyNumber),
      detail: student.fullName,
    },
    {
      label: "Service Record",
      href: studentPath(student.armyNumber, "/service-record"),
      detail: "Full history & certificates",
    },
    ...enrs.slice(0, 4).map((e) => ({
      label: `Enrollment #${e.enrollmentId}`,
      href: `/enrollments/${e.enrollmentId}`,
      detail: `${e.courseCode} ${e.intakeNumber}`,
    })),
  ];

  return {
    offline: true,
    source: "database",
    answer: lines.join("\n"),
    references,
  };
}

async function courseDetail(codeOrName: string): Promise<AssistantResponse | null> {
  const pattern = `%${codeOrName}%`;
  const [course] = await db
    .select()
    .from(courses)
    .where(
      or(ilike(courses.courseCode, pattern), ilike(courses.courseName, pattern))
    )
    .limit(1);

  if (!course) return null;

  const subjects = await db
    .select({
      subjectId: courseSubjects.subjectId,
      subjectName: courseSubjects.subjectName,
      maxMarks: courseSubjects.maxMarks,
    })
    .from(courseSubjects)
    .where(eq(courseSubjects.courseId, course.courseId))
    .orderBy(courseSubjects.sortOrder);

  const intakes = await db
    .select({
      intakeId: courseIntakes.intakeId,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      isActive: courseIntakes.isActive,
    })
    .from(courseIntakes)
    .where(eq(courseIntakes.courseId, course.courseId))
    .orderBy(desc(courseIntakes.year))
    .limit(8);

  const noticeCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(courseNotices)
    .where(eq(courseNotices.courseId, course.courseId));

  const lines = [
    `Course: ${course.courseCode} — ${course.courseName}`,
    `Duration: ${course.durationWeeks} weeks · Passing mark: ${course.passingMark}`,
    `Active: ${course.isActive ? "yes" : "no"}`,
    "",
    subjects.length
      ? `Subjects (${subjects.length}): ${subjects.map((s) => s.subjectName).join(", ")}`
      : "No subjects defined yet — add them on the course page before importing results/notices.",
    "",
    intakes.length
      ? `Intakes: ${intakes
          .map(
            (i) =>
              `${i.intakeNumber} (${i.year})${i.isActive ? "" : " [inactive]"}`
          )
          .join("; ")}`
      : "No intakes yet.",
    `Subject notices on file: ${Number(noticeCount[0]?.count ?? 0)}`,
  ];

  return {
    offline: true,
    source: "database",
    answer: lines.join("\n"),
    references: [
      {
        label: "Course page",
        href: `/courses/${course.courseId}`,
        detail: course.courseCode,
      },
      {
        label: "Course Notices for this course",
        href: `/course-notices/${course.courseId}`,
        detail: "Subjects → upload / download notices",
      },
      ...intakes.slice(0, 4).map((i) => ({
        label: `Intake ${i.intakeNumber}`,
        href: `/intakes/${i.intakeId}`,
        detail: String(i.year),
      })),
      {
        label: "Import results",
        href: "/results/import",
        detail: "After enrollments exist",
      },
    ],
  };
}

async function topPerformers(
  opts: { year?: number; courseCode?: string; limit?: number } = {}
): Promise<AssistantResponse> {
  const limit = opts.limit ?? 10;
  const year = opts.year ?? new Date().getFullYear();

  const conditions = [
    isNotNull(enrollments.position),
    eq(courseIntakes.year, year),
  ];

  if (opts.courseCode) {
    conditions.push(ilike(courses.courseCode, `%${opts.courseCode}%`));
  }

  const rows = await db
    .select({
      enrollmentId: enrollments.enrollmentId,
      armyNumber: students.armyNumber,
      fullName: students.fullName,
      rank: enrollments.rankAtEnrollment,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      intakeNumber: courseIntakes.intakeNumber,
      year: courseIntakes.year,
      averageMarks: enrollments.averageMarks,
      grade: enrollments.grade,
      position: enrollments.position,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
    .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
    .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
    .where(and(...conditions))
    .orderBy(enrollments.position, desc(enrollments.averageMarks))
    .limit(limit);

  // Fallback: no positions yet — rank by average marks
  let usedFallback = false;
  let list = rows;
  if (list.length === 0) {
    usedFallback = true;
    const avgConditions = [
      isNotNull(enrollments.averageMarks),
      eq(courseIntakes.year, year),
    ];
    if (opts.courseCode) {
      avgConditions.push(ilike(courses.courseCode, `%${opts.courseCode}%`));
    }
    list = await db
      .select({
        enrollmentId: enrollments.enrollmentId,
        armyNumber: students.armyNumber,
        fullName: students.fullName,
        rank: enrollments.rankAtEnrollment,
        courseCode: courses.courseCode,
        courseName: courses.courseName,
        intakeNumber: courseIntakes.intakeNumber,
        year: courseIntakes.year,
        averageMarks: enrollments.averageMarks,
        grade: enrollments.grade,
        position: enrollments.position,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentArmyNumber, students.armyNumber))
      .innerJoin(courseIntakes, eq(enrollments.intakeId, courseIntakes.intakeId))
      .innerJoin(courses, eq(courseIntakes.courseId, courses.courseId))
      .where(and(...avgConditions))
      .orderBy(desc(enrollments.averageMarks))
      .limit(limit);
  }

  if (list.length === 0) {
    return {
      offline: true,
      source: "database",
      answer: [
        `No top performers found for ${year}${
          opts.courseCode ? ` / ${opts.courseCode.toUpperCase()}` : ""
        }.`,
        "",
        "Enter and import results first, then recalculate positions (usually after import).",
        "Then ask again, or open Top Performers in Reports.",
      ].join("\n"),
      references: [
        {
          label: "Sidebar → Reports → Top Performers",
          href: "/reports/top-performers",
        },
        { label: "Sidebar → Results → Import", href: "/results/import" },
        { label: "Sidebar → Results", href: "/results" },
      ],
    };
  }

  const best = list[0];
  const lines = [
    usedFallback
      ? `Best students by average marks (${year}${
          opts.courseCode ? `, ${opts.courseCode.toUpperCase()}` : ""
        }) — positions not set yet:`
      : `Top performers (${year}${
          opts.courseCode ? `, ${opts.courseCode.toUpperCase()}` : ""
        }):`,
    "",
    `Best in this list: ${best.rank} ${best.fullName} (${best.armyNumber})`,
    `  ${best.courseCode} ${best.intakeNumber} — position ${
      best.position ?? "—"
    }, avg ${best.averageMarks ?? "—"}%, grade ${best.grade ?? "—"}`,
    "",
    ...list.map(
      (r, i) =>
        `${i + 1}. Pos ${r.position ?? "—"} · ${r.rank} ${r.fullName} · ${
          r.courseCode
        } ${r.intakeNumber} · avg ${r.averageMarks ?? "—"}% · ${r.grade ?? "—"}`
    ),
  ];

  return {
    offline: true,
    source: "database",
    answer: lines.join("\n"),
    references: [
      {
        label: "Sidebar → Reports → Top Performers",
        href: "/reports/top-performers",
        detail: "Full ranked report",
      },
      ...list.slice(0, 8).map((r) => ({
        label: `${r.rank} ${r.fullName}`,
        href: studentPath(r.armyNumber),
        detail: `${r.courseCode} ${r.intakeNumber} · Pos ${r.position ?? "—"} · avg ${
          r.averageMarks ?? "—"
        }%`,
      })),
      {
        label: `Enrollment #${best.enrollmentId}`,
        href: `/enrollments/${best.enrollmentId}`,
        detail: "Marks & certificate if eligible",
      },
    ],
  };
}

async function statsOverview(): Promise<AssistantResponse> {
  const [s, c, e, r] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(students).where(eq(students.isActive, true)),
    db.select({ count: sql<number>`count(*)` }).from(courses).where(eq(courses.isActive, true)),
    db.select({ count: sql<number>`count(*)` }).from(enrollments),
    db.select({ count: sql<number>`count(*)` }).from(results),
  ]);

  return {
    offline: true,
    source: "database",
    answer: [
      "Database overview (live from this installation):",
      `• Active students: ${Number(s[0]?.count ?? 0)}`,
      `• Active courses: ${Number(c[0]?.count ?? 0)}`,
      `• Enrollments: ${Number(e[0]?.count ?? 0)}`,
      `• Result rows (subject marks): ${Number(r[0]?.count ?? 0)}`,
      "",
      "Open the pages below to work with this data offline on this PC.",
    ].join("\n"),
    references: [
      { label: "Sidebar → Dashboard", href: "/dashboard" },
      { label: "Sidebar → Students", href: "/students" },
      { label: "Sidebar → Courses", href: "/courses" },
      { label: "Sidebar → Results", href: "/results" },
      { label: "Sidebar → Analytics", href: "/analytics" },
    ],
  };
}

function extractQuotedOrAfter(
  query: string,
  patterns: RegExp[]
): string | null {
  for (const re of patterns) {
    const m = query.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

export async function askAssistant(
  rawQuery: string,
  user: SessionUser
): Promise<AssistantResponse> {
  const query = rawQuery.trim();
  if (!query || query.length < 2) {
    return helpText();
  }

  const q = query.toLowerCase();

  if (
    /^(help|hi|hello|habari|mambo|what can you|nini|msaada)\b/.test(q) ||
    q === "?"
  ) {
    return helpText();
  }

  // Top / best students
  if (
    /(top\s*perform|best\s*student|mwanafunzi\s*bora|wanafunzi\s*bora|\bbora\b|position\s*1|nafasi\s*ya\s*kwanza|highest\s*mark|leading\s*student)/i.test(
      q
    )
  ) {
    const yearMatch = q.match(/\b(20\d{2})\b/);
    const courseMatch = q.match(
      /\b(bcc|obgc|rog|rsoc|aat|mgcc|faqc|obatic|ebc|eac|gmc|scc|fdc|foo)\b/i
    );
    return topPerformers({
      year: yearMatch ? parseInt(yearMatch[1], 10) : undefined,
      courseCode: courseMatch?.[1],
      limit: 10,
    });
  }

  // Stats
  if (
    /(how many|count|overview|statistics|stats|idadi|jumla|database overview)/i.test(
      q
    ) &&
    /(student|course|enrollment|result|matokeo|wanafunzi|kozi)/i.test(q)
  ) {
    return statsOverview();
  }
  if (/^(stats|overview|dashboard summary)$/i.test(q.trim())) {
    return statsOverview();
  }

  // Student lookup
  const studentKey = extractQuotedOrAfter(query, [
    /(?:student|mwanafunzi|army\s*number|find)\s+["']?([A-Za-z0-9][\w\s.\-]{1,60})["']?/i,
    /(?:who is|profile of)\s+["']?([A-Za-z0-9][\w\s.\-]{1,60})["']?/i,
  ]);
  if (
    studentKey ||
    /^(SN-|T\d|[A-Z]{1,4}-\d)/i.test(query.trim()) ||
    (/(student|mwanafunzi|army)/i.test(q) &&
      !/(how|where|import|certificate)/i.test(q))
  ) {
    const key =
      studentKey ||
      query
        .replace(/^(find|show|get|student|mwanafunzi|army\s*number)\s+/i, "")
        .trim();
    if (key.length >= 2) {
      const detail = await studentDetail(key);
      if (detail) return detail;

      const soft = await searchStudents(key);
      if (soft.length) {
        return {
          offline: true,
          source: "database",
          answer: `No exact match for "${key}". Closest students from the database:`,
          references: soft,
        };
      }
    }
  }

  // Course lookup
  const courseKey = extractQuotedOrAfter(query, [
    /(?:course|kozi)\s+["']?([A-Za-z0-9][\w\s.\-]{1,60})["']?/i,
    /\b(BCC|OBGC|ROG|RSOC|AAT|MGCC|FAQC|OBATIC)\b/i,
  ]);
  if (
    courseKey ||
    (/\b(bcc|obgc|rog|rsoc|aat|mgcc)\b/i.test(q) &&
      !/(import|how|where|certificate)/i.test(q))
  ) {
    const key = courseKey || (q.match(/\b(bcc|obgc|rog|rsoc|aat|mgcc|faqc)\b/i)?.[1] ?? "");
    if (key) {
      const detail = await courseDetail(key);
      if (detail) return detail;
      const soft = await searchCourses(key);
      if (soft.length) {
        return {
          offline: true,
          source: "database",
          answer: `Courses matching "${key}":`,
          references: soft.map((c) => ({
            label: `${c.courseCode} — ${c.courseName}`,
            href: `/courses/${c.courseId}`,
            detail: `${c.durationWeeks} weeks`,
          })),
        };
      }
    }
  }

  // Intake search
  if (/\b(intake|int\s*\d|kundi)\b/i.test(q)) {
    const token =
      query.match(/\b(INT[\s-]?\d[\w-]*)\b/i)?.[1] ||
      query.replace(/intake|kundi|show|find/gi, "").trim() ||
      query;
    const intakes = await searchIntakes(token);
    if (intakes.length) {
      return {
        offline: true,
        source: "database",
        answer: `Intakes found in the database for "${token}":`,
        references: intakes.map((i) => ({
          label: `${i.courseCode} — ${i.intakeNumber}`,
          href: `/intakes/${i.intakeId}`,
          detail: String(i.year),
        })),
      };
    }
  }

  // Knowledge / how-to
  const knowledge = matchKnowledge(query, user.role);
  if (knowledge.length) {
    const primary = knowledge[0];
    const answer = [
      primary.summary,
      "",
      primary.steps?.length
        ? `Steps:\n${primary.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
        : null,
      "",
      "Open these locations in the system (works on this local PC):",
    ]
      .filter(Boolean)
      .join("\n");

    // Enrich with live DB hits if query looks like an entity
    const refs = refsFromKnowledge(knowledge);
    const maybeCourses = await searchCourses(query);
    for (const c of maybeCourses.slice(0, 2)) {
      refs.push({
        label: `Course: ${c.courseCode}`,
        href: `/courses/${c.courseId}`,
        detail: c.courseName,
      });
    }

    return {
      offline: true,
      source: maybeCourses.length ? "mixed" : "knowledge",
      answer,
      references: refs,
    };
  }

  // Fallback: broad search
  const [stu, crs, intk] = await Promise.all([
    searchStudents(query),
    searchCourses(query),
    searchIntakes(query),
  ]);

  const references = [
    ...stu,
    ...crs.map((c) => ({
      label: `${c.courseCode} — ${c.courseName}`,
      href: `/courses/${c.courseId}`,
      detail: "Course",
    })),
    ...intk.map((i) => ({
      label: `${i.courseCode} — ${i.intakeNumber}`,
      href: `/intakes/${i.intakeId}`,
      detail: String(i.year),
    })),
  ];

  if (references.length) {
    return {
      offline: true,
      source: "database",
      answer: `I searched the local database for "${query}". Open a result below:`,
      references,
    };
  }

  return {
    offline: true,
    source: "help",
    answer: [
      `I could not find "${query}" in the database or system guide.`,
      "",
      "Try: a student army number/name, a course code (BCC), an intake (INT 15-26),",
      "or a how-to question (e.g. \"how to import results\", \"where is certificate\").",
    ].join("\n"),
    references: [
      { label: "Sidebar → Students", href: "/students" },
      { label: "Sidebar → Courses", href: "/courses" },
      { label: "Sidebar → Results → Import", href: "/results/import" },
    ],
  };
}
