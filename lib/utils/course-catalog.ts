/**
 * Display labels and sort order for SOFA course folders.
 * Maps database course codes → short folder titles shown on /courses.
 */

export type CourseFamily =
  | "officers"
  | "observation"
  | "artilleryman"
  | "technician"
  | "other";

export interface CourseDisplayMeta {
  /** Short label on the folder (no long names). */
  label: string;
  family: CourseFamily;
  /** Sort within family (lower first). */
  order: number;
}

/** Preferred folder order across the page. */
export const FAMILY_ORDER: CourseFamily[] = [
  "officers",
  "observation",
  "artilleryman",
  "technician",
  "other",
];

export const FAMILY_LABELS: Record<CourseFamily, string> = {
  officers: "Officer Courses",
  observation: "Observation & Survey",
  artilleryman: "Artilleryman",
  technician: "Technicians",
  other: "Other Courses",
};

/**
 * Exact DB code → display. Unknown codes fall back to heuristics below.
 */
const EXACT: Record<string, CourseDisplayMeta> = {
  FAOC: { label: "FAOC", family: "officers", order: 1 },
  FAOC1: { label: "FAOC", family: "officers", order: 1 },
  FAOAC: { label: "FAOC", family: "officers", order: 1 },
  ROG: { label: "ROGC", family: "officers", order: 2 },
  ROGC: { label: "ROGC", family: "officers", order: 2 },
  RO0G2025: { label: "ROGC", family: "officers", order: 2 },
  ROOG25: { label: "ROGC", family: "officers", order: 2 },
  ROOG2025: { label: "ROGC", family: "officers", order: 2 },
  BCC: { label: "BCC", family: "officers", order: 3 },
  OBGC: { label: "OBGC", family: "observation", order: 1 },
  ROPOC: { label: "ROPOC", family: "observation", order: 2 },
  RSOC: { label: "RSOC", family: "observation", order: 3 },
  ASVY: { label: "ASVY-L2", family: "observation", order: 5 },
  "ASVY-L1": { label: "ASVY-L1", family: "observation", order: 5 },
  "ASVY-L2": { label: "ASVY-L2", family: "observation", order: 6 },
  "ASVY-L3": { label: "ASVY-L3", family: "observation", order: 7 },
  OBATC: { label: "OBATC", family: "observation", order: 4 },
  MGCC: { label: "MGCC", family: "other", order: 1 },
  MGC: { label: "MGC", family: "other", order: 2 },
  "ARTY-L1": { label: "ARTYMAN-L1", family: "artilleryman", order: 1 },
  "ARTY-L2": { label: "ARTYMAN-L2", family: "artilleryman", order: 2 },
  "ARTY-L3": { label: "ARTYMAN-L3", family: "artilleryman", order: 3 },
  ARTYMAN: { label: "ARTYMAN", family: "artilleryman", order: 0 },
  "AAT-L1": { label: "AATC-L1", family: "technician", order: 1 },
  "AAT-L2": { label: "AATC-L2", family: "technician", order: 2 },
  "AAT-L3": { label: "AATC-L3", family: "technician", order: 3 },
  "AATC-L1": { label: "AATC-L1", family: "technician", order: 1 },
  "AATC-L2": { label: "AATC-L2", family: "technician", order: 2 },
  "AATC-L3": { label: "AATC-L3", family: "technician", order: 3 },
  "ARTY-TECH-L1": { label: "ARTY-TECH-L1", family: "technician", order: 4 },
  "ARTY-TECH-L2": { label: "ARTY-TECH-L2", family: "technician", order: 5 },
  "ARTY-TECH-L3": { label: "ARTY-TECH-L3", family: "technician", order: 6 },
  "GT-L1": { label: "GT-L1", family: "technician", order: 9 },
  "GT-L2": { label: "GT-L2", family: "technician", order: 10 },
  "GT-L3": { label: "GT-L3", family: "technician", order: 11 },
};

export function getCourseDisplayMeta(
  courseCode: string,
  courseName?: string | null
): CourseDisplayMeta {
  const code = courseCode.trim().toUpperCase();
  if (EXACT[code]) return EXACT[code];

  const name = (courseName ?? "").toUpperCase();
  const blob = `${code} ${name}`;

  if (/ARTY\s*-?\s*TECH/.test(blob)) {
    const level =
      blob.match(/L\s*-?\s*([123])/)?.[1] ?? code.match(/-?([123])$/)?.[1];
    if (level === "1")
      return { label: "ARTY-TECH-L1", family: "technician", order: 4 };
    if (level === "2")
      return { label: "ARTY-TECH-L2", family: "technician", order: 5 };
    if (level === "3")
      return { label: "ARTY-TECH-L3", family: "technician", order: 6 };
    return { label: "ARTY-TECH-L1", family: "technician", order: 4 };
  }

  if (/ARMAMENT|AATC|\bAAT\b/.test(blob)) {
    const level = blob.match(/L\s*-?\s*([123])/)?.[1] ?? code.match(/-?([123])$/)?.[1];
    if (level === "1") return { label: "AATC-L1", family: "technician", order: 1 };
    if (level === "2") return { label: "AATC-L2", family: "technician", order: 2 };
    if (level === "3") return { label: "AATC-L3", family: "technician", order: 3 };
    return { label: code, family: "technician", order: 9 };
  }

  if (/ARTYMAN|ARTY\s*MAN|\bARTY-L/.test(blob)) {
    const level = blob.match(/L\s*-?\s*([123])/)?.[1] ?? code.match(/L-?([123])/)?.[1];
    if (level === "1") return { label: "ARTYMAN-L1", family: "artilleryman", order: 1 };
    if (level === "2") return { label: "ARTYMAN-L2", family: "artilleryman", order: 2 };
    if (level === "3") return { label: "ARTYMAN-L3", family: "artilleryman", order: 3 };
    return { label: code, family: "artilleryman", order: 9 };
  }

  if (/\bASVY\b|ARTY\s*SVY|ARTILLERY\s*SURVEY/.test(blob)) {
    const level =
      blob.match(/L\s*-?\s*([123])/)?.[1] ?? code.match(/-?([123])$/)?.[1];
    if (level === "1")
      return { label: "ASVY-L1", family: "observation", order: 5 };
    if (level === "3")
      return { label: "ASVY-L3", family: "observation", order: 7 };
    return { label: "ASVY-L2", family: "observation", order: 6 };
  }

  if (/\bROG/.test(blob)) return { label: "ROGC", family: "officers", order: 2 };
  if (/\bFAOC|\bFAOAC/.test(blob)) return { label: "FAOC", family: "officers", order: 1 };
  if (/\bBCC\b/.test(blob)) return { label: "BCC", family: "officers", order: 3 };
  if (/\bOBGC\b/.test(blob)) return { label: "OBGC", family: "observation", order: 1 };
  if (/\bROPOC\b/.test(blob)) return { label: "ROPOC", family: "observation", order: 2 };
  if (/\bRSOC\b/.test(blob)) return { label: "RSOC", family: "observation", order: 3 };
  if (/\bOBATC\b/.test(blob)) return { label: "OBATC", family: "observation", order: 4 };
  if (/\bMGCC\b/.test(blob)) return { label: "MGCC", family: "other", order: 1 };

  return { label: code, family: "other", order: 50 };
}

export function sortCoursesByCatalog<
  T extends { courseCode: string; courseName?: string | null },
>(rows: T[]): (T & { display: CourseDisplayMeta })[] {
  const familyRank = Object.fromEntries(
    FAMILY_ORDER.map((f, i) => [f, i])
  ) as Record<CourseFamily, number>;

  return rows
    .map((row) => ({
      ...row,
      display: getCourseDisplayMeta(row.courseCode, row.courseName),
    }))
    .sort((a, b) => {
      const fa = familyRank[a.display.family] - familyRank[b.display.family];
      if (fa !== 0) return fa;
      if (a.display.order !== b.display.order) {
        return a.display.order - b.display.order;
      }
      return a.display.label.localeCompare(b.display.label);
    });
}
