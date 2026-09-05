export type AssistantRole = "admin" | "instructor" | "viewer" | "all";

export interface KnowledgeEntry {
  id: string;
  title: string;
  keywords: string[];
  summary: string;
  steps?: string[];
  href: string;
  locationLabel: string;
  roles?: AssistantRole[];
}

/** Offline SOFA knowledge — how to use the system and where data lives in the UI. */
export const SYSTEM_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "students",
    title: "Students",
    keywords: ["student", "wanafunzi", "army number", "personnel", "profile", "mwanafunzi"],
    summary:
      "Student records (army number, rank, unit, contacts) are stored in the students table and managed under Students.",
    steps: [
      "Open Sidebar → Students",
      "Search or open a student profile",
      "Use Service Record for course history and certificates",
    ],
    href: "/students",
    locationLabel: "Sidebar → Students",
  },
  {
    id: "courses",
    title: "Courses",
    keywords: ["course", "kozi", "bcc", "obgc", "rog", "subject", "masomo"],
    summary:
      "Courses and their subjects live under Training → Courses. Subjects for notices and results must be defined on each course.",
    steps: [
      "Sidebar → Courses",
      "Open a course to view subjects",
      "Add or edit subjects on the course page",
    ],
    href: "/courses",
    locationLabel: "Sidebar → Courses",
  },
  {
    id: "intakes",
    title: "Intakes",
    keywords: ["intake", "int", "kundi", "year", "2026"],
    summary:
      "Each intake (e.g. INT 15-26) belongs to a course and holds enrollments for that running.",
    steps: ["Sidebar → Intakes", "Open an intake to see enrollments"],
    href: "/intakes",
    locationLabel: "Sidebar → Intakes",
  },
  {
    id: "enrollments",
    title: "Enrollments",
    keywords: ["enrollment", "enrol", "register", "status", "completed", "failed"],
    summary:
      "Enrollments link a student to an intake. Status (enrolled, completed, failed, etc.) controls certificates and reports.",
    steps: [
      "Sidebar → Enrollments",
      "Open an enrollment for marks, status, and certificate download",
    ],
    href: "/enrollments",
    locationLabel: "Sidebar → Enrollments",
  },
  {
    id: "results",
    title: "Results",
    keywords: ["result", "matokeo", "marks", "grade", "import", "excel", "score"],
    summary:
      "Subject marks are stored per enrollment. You can enter one-by-one or import Excel/CSV for a whole intake.",
    steps: [
      "Sidebar → Results — view or add marks",
      "Results → Import — upload Excel for an intake",
      "Download the system template after selecting the intake",
    ],
    href: "/results",
    locationLabel: "Sidebar → Results",
  },
  {
    id: "results-import",
    title: "Import results from Excel",
    keywords: ["import", "upload", "excel", "xlsx", "csv", "template", "bulk"],
    summary:
      "Bulk import needs students enrolled in the intake first. Column headers must include Army Number and subject names.",
    steps: [
      "Go to Results → Import Results",
      "Select the intake",
      "Download Excel template",
      "Paste marks from your coordinator file",
      "Upload and import",
    ],
    href: "/results/import",
    locationLabel: "Sidebar → Results → Import",
  },
  {
    id: "course-notices",
    title: "Course Notices",
    keywords: ["notice", "notisi", "announcement", "subject notice", "upload notice"],
    summary:
      "Notices are per course subject. Open Course Notices → course → subject to view, upload, or download PDFs.",
    steps: [
      "Sidebar → Course Notices",
      "Select a course",
      "Select a subject",
      "Publish notice or Download PDF / Download All Notices",
    ],
    href: "/course-notices",
    locationLabel: "Sidebar → Course Notices",
  },
  {
    id: "certificates",
    title: "Graduation certificates",
    keywords: ["certificate", "cheti", "graduation", "download certificate", "print"],
    summary:
      "Certificates are issued from an enrollment when the student has passed / completed. Signatures are set under Cert. Signatures.",
    steps: [
      "Admin → Cert. Signatures — upload Chief Instructor & Commandant signatures",
      "Open Enrollments → eligible enrollment → Download Certificate",
      "Or Student → Service Record → Download Certificate",
    ],
    href: "/enrollments",
    locationLabel: "Enrollments or Student Service Record",
  },
  {
    id: "signatures",
    title: "Certificate signatures",
    keywords: ["signature", "sahihi", "commandant", "chief instructor"],
    summary:
      "Official signatures for certificates are stored as image files and linked in official_signatures.",
    href: "/settings/signatures",
    locationLabel: "Sidebar → Admin → Cert. Signatures",
    roles: ["admin"],
  },
  {
    id: "backup",
    title: "Backup & restore",
    keywords: ["backup", "restore", "zip", "nakala", "usb"],
    summary:
      "Full backup downloads a ZIP of database tables and key public files. Keep it offline on USB for disaster recovery.",
    steps: [
      "Sidebar → Admin → Backup",
      "Download backup ZIP",
      "Copy to external storage",
      "Use Restore only when you need to recover",
    ],
    href: "/settings/backup",
    locationLabel: "Sidebar → Admin → Backup",
    roles: ["admin"],
  },
  {
    id: "reports",
    title: "Reports",
    keywords: ["report", "ripoti", "failures", "by course", "by student"],
    summary:
      "Reports summarise performance by course, student, failures, and top performers from enrollment/results data.",
    href: "/reports",
    locationLabel: "Sidebar → Reports",
  },
  {
    id: "top-performers",
    title: "Top performers / best students",
    keywords: [
      "top performers",
      "top performer",
      "best student",
      "best students",
      "mwanafunzi bora",
      "wanafunzi bora",
      "bora",
      "position 1",
      "first position",
      "nafasi ya kwanza",
      "leading",
      "highest marks",
      "trophy",
    ],
    summary:
      "Top students are ranked by position and average marks on each enrollment after results are entered. Ask the assistant “mwanafunzi bora” or open the Top Performers report.",
    steps: [
      "Sidebar → Reports → Top Performers — positions 1–3 by year",
      "Or ask the Offline Assistant: “mwanafunzi bora BCC” / “top students 2026”",
      "Open a student link to see profile, service record, and certificate if eligible",
    ],
    href: "/reports/top-performers",
    locationLabel: "Sidebar → Reports → Top Performers",
  },
  {
    id: "analytics",
    title: "Analytics",
    keywords: ["analytics", "comparative", "chart", "trend", "kpi"],
    summary:
      "Analytics and Comparative views analyse intakes, courses, and years from database records.",
    href: "/analytics",
    locationLabel: "Sidebar → Analytics / Comparative",
  },
  {
    id: "documents",
    title: "Documents",
    keywords: ["document", "file", "archive"],
    summary: "School documents are managed under Admin → Documents.",
    href: "/documents",
    locationLabel: "Sidebar → Admin → Documents",
    roles: ["admin"],
  },
  {
    id: "audit",
    title: "Activity logs",
    keywords: ["audit", "log", "history", "who changed", "activity", "login history"],
    summary:
      "Activity Logs show what happened, when, and who (admin only). Includes data changes and login history.",
    steps: [
      "Sidebar → Admin → Activity Logs",
      "Tab Activity — create/update/delete (students, results, notices…)",
      "Tab Login history — successful and failed sign-ins",
      "Filter by user name, area, action, or date",
    ],
    href: "/audit-logs",
    locationLabel: "Sidebar → Admin → Activity Logs",
    roles: ["admin"],
  },
  {
    id: "password",
    title: "Change password",
    keywords: ["password", "nywila", "login", "security", "admin123"],
    summary:
      "Change account password offline with: npm run change-password in the school project folder (terminal).",
    steps: [
      "Open terminal in ~/Desktop/SOFA2/school",
      "Run: npm run change-password",
      "Enter username and new password (min 8 characters)",
      "Log out and log in with the new password",
    ],
    href: "/dashboard",
    locationLabel: "Terminal → npm run change-password",
  },
  {
    id: "login",
    title: "Login & roles",
    keywords: ["login", "role", "admin", "instructor", "viewer", "permission"],
    summary:
      "Roles: admin (full), instructor (results for assigned course), viewer (read-mostly). Session lasts 24 hours.",
    href: "/login",
    locationLabel: "Login page",
  },
];

export function matchKnowledge(
  query: string,
  role: string
): KnowledgeEntry[] {
  const q = query.toLowerCase();
  const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length > 1);

  const scored = SYSTEM_KNOWLEDGE.map((entry) => {
    if (
      entry.roles &&
      entry.roles.length > 0 &&
      !entry.roles.includes("all") &&
      !entry.roles.includes(role as AssistantRole)
    ) {
      return { entry, score: 0 };
    }

    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw)) score += 3;
      for (const t of tokens) {
        if (kw.includes(t) || t.includes(kw)) score += 1;
      }
    }
    if (q.includes(entry.title.toLowerCase())) score += 4;
    return { entry, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 4).map((s) => s.entry);
}
