/**
 * Course name order:
 * - Officer courses (FAOC / FAOAC, OBGC, ROGC, BCC, ROPOC, RSOC): INITIALS SURNAME
 *   e.g. "Kilasa Emmanuel Petro" → "KE PETRO"
 * - Soldier courses (Master Gunnery and every level course, and any other
 *   non-officer course): SURNAME INITIALS
 *   e.g. "Michael Andrew Mwakyoma" → "MWAKYOMA MA"
 *
 * Already-abbreviated forms ("KE PETRO" or "PETRO KE") are recognised either way.
 */

export type NameOrder = "initials-first" | "surname-first";

const OFFICER_CODES = new Set([
  "FAOC",
  "FAOC1",
  "FAOAC",
  "OBGC",
  "ROGC",
  "ROG",
  "RO0G2025",
  "ROOG25",
  "ROOG2025",
  "BCC",
  "ROPOC",
  "RSOC",
]);

export function isOfficerCourse(
  courseCode?: string | null,
  courseName?: string | null
): boolean {
  const code = (courseCode ?? "").trim().toUpperCase();
  if (OFFICER_CODES.has(code)) return true;

  const blob = `${code} ${courseName ?? ""}`.toUpperCase();
  if (/\bOFFICER/.test(blob)) return true;
  if (/\bFAOAC\b|\bFAOC\b/.test(blob)) return true;
  if (/\bOBGC\b/.test(blob)) return true;
  if (/\bROPOC\b/.test(blob)) return true;
  if (/\bRSOC\b/.test(blob)) return true;
  if (/\bBCC\b/.test(blob)) return true;
  if (/\bROGC\b|\bROG\b|RO0G|ROOG/.test(blob)) return true;
  return false;
}

export function nameOrderForCourse(
  courseCode?: string | null,
  courseName?: string | null
): NameOrder {
  if (!courseCode?.trim() && !courseName?.trim()) return "initials-first";
  return isOfficerCourse(courseCode, courseName)
    ? "initials-first"
    : "surname-first";
}

/** Initials-first only when every known course is an officer course. */
export function nameOrderForCourses(
  courses: Array<{ courseCode?: string | null; courseName?: string | null }>
): NameOrder {
  if (courses.length === 0) return "initials-first";
  return courses.every((course) =>
    isOfficerCourse(course.courseCode, course.courseName)
  )
    ? "initials-first"
    : "surname-first";
}

function isInitialsToken(token: string): boolean {
  if (token.includes("-")) return false;
  const letters = token.replace(/\./g, "");
  return /^[A-Za-z]{1,3}$/.test(letters);
}

function compactInitials(token: string): string {
  return token.replace(/\./g, "").toUpperCase();
}

function splitIdentity(name: string): { initials: string; surname: string } {
  const parts = name.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length === 0) return { initials: "", surname: "" };
  if (parts.length === 1) return { initials: "", surname: parts[0].toUpperCase() };

  const firstIsInitials = isInitialsToken(parts[0]);
  const lastIsInitials = isInitialsToken(parts[parts.length - 1]);

  if (parts.length === 2 && firstIsInitials && !lastIsInitials) {
    return {
      initials: compactInitials(parts[0]),
      surname: parts[1].toUpperCase(),
    };
  }

  if (lastIsInitials && !firstIsInitials) {
    return {
      initials: compactInitials(parts[parts.length - 1]),
      surname: parts.slice(0, -1).join(" ").toUpperCase(),
    };
  }

  if (parts.length === 2) {
    return {
      initials: parts[0][0]?.toUpperCase() ?? "",
      surname: parts[1].toUpperCase(),
    };
  }

  if (firstIsInitials) {
    return {
      initials: compactInitials(parts[0]),
      surname: parts.slice(1).join(" ").toUpperCase(),
    };
  }

  const surname = parts[parts.length - 1].toUpperCase();
  const initials = parts
    .slice(0, -1)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return { initials, surname };
}

function resolveOrder(
  courseOrOrder?: string | NameOrder | null,
  courseName?: string | null
): NameOrder {
  if (courseOrOrder === "initials-first" || courseOrOrder === "surname-first") {
    return courseOrOrder;
  }
  if (!courseOrOrder && !courseName) return "initials-first";
  return nameOrderForCourse(courseOrOrder, courseName);
}

export function displayName(
  name: string | null | undefined,
  courseOrOrder?: string | NameOrder | null,
  courseName?: string | null
): string {
  if (name == null || String(name).trim() === "") return "—";

  const { initials, surname } = splitIdentity(String(name));
  if (!surname && !initials) return "—";
  if (!initials) return surname;
  if (!surname) return initials;

  const order = resolveOrder(courseOrOrder, courseName);
  return order === "surname-first"
    ? `${surname} ${initials}`
    : `${initials} ${surname}`;
}
