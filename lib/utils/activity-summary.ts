const TABLE_LABELS: Record<string, string> = {
  students: "Student",
  courses: "Course",
  course_intakes: "Intake",
  course_subjects: "Subject",
  course_prerequisites: "Course prerequisite",
  enrollments: "Enrollment",
  results: "Result / marks",
  course_notices: "Course notice",
  course_exercises: "Training exercise",
  documents: "Document",
  certificates: "Certificate",
  official_signatures: "Certificate signature",
  users: "User account",
  system_backup: "System backup",
};

function pick(obj: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return null;
}

/**
 * Human-readable one-line summary: what happened.
 */
export function summarizeAuditEvent(log: {
  action: string;
  tableName: string;
  recordId: string;
  oldValues?: unknown;
  newValues?: unknown;
}): string {
  const entity = TABLE_LABELS[log.tableName] ?? log.tableName.replace(/_/g, " ");
  const neu = (log.newValues ?? null) as Record<string, unknown> | null;
  const old = (log.oldValues ?? null) as Record<string, unknown> | null;

  const nameHint =
    pick(neu, [
      "fullName",
      "title",
      "courseName",
      "courseCode",
      "subjectName",
      "intakeNumber",
      "username",
      "name",
      "filename",
    ]) ||
    pick(old, [
      "fullName",
      "title",
      "courseName",
      "courseCode",
      "subjectName",
      "intakeNumber",
      "username",
      "name",
    ]);

  const label = nameHint
    ? `${entity} “${nameHint}” (${log.recordId})`
    : `${entity} #${log.recordId}`;

  switch (log.action) {
    case "create":
      if (log.tableName === "users" && neu?.event === "logout") {
        return `Logged out (${log.recordId})`;
      }
      if (log.tableName === "results" && String(log.recordId).includes("import")) {
        return `Imported results — ${log.recordId}`;
      }
      if (log.tableName === "system_backup") {
        return `Downloaded system backup — ${log.recordId}`;
      }
      return `Created ${label}`;
    case "update":
      return `Updated ${label}`;
    case "delete":
      return `Deleted ${label}`;
    default:
      return `${log.action} on ${label}`;
  }
}

export function formatLogWhen(date: Date | string): string {
  return new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
