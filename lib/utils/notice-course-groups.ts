import {
  getCourseDisplayMeta,
  type CourseFamily,
} from "@/lib/utils/course-catalog";

export type NoticeGroupKey =
  | "artyman"
  | "aatc"
  | "asvy"
  | "arty-tech"
  | "gt"
  | "single";

export interface NoticeGroupMeta {
  key: NoticeGroupKey | string;
  title: string;
  family: CourseFamily;
  hasLevels: boolean;
}

/** Leveled course families shown as one folder → L1/L2/L3. */
const LEVEL_GROUPS: Array<{
  key: NoticeGroupKey;
  title: string;
  family: CourseFamily;
  match: (code: string, label: string) => boolean;
  levelOf: (code: string, label: string) => string | null;
}> = [
  {
    key: "artyman",
    title: "ARTYMAN",
    family: "artilleryman",
    match: (code, label) =>
      /ARTY-L|ARTYMAN/i.test(code) || /ARTYMAN/i.test(label),
    levelOf: (code, label) => {
      const m = `${code} ${label}`.match(/L\s*-?\s*([123])/i);
      return m ? `L${m[1]}` : null;
    },
  },
  {
    key: "aatc",
    title: "AATC",
    family: "technician",
    match: (code, label) =>
      (/^AAT-L|^AATC/i.test(code) || /AATC/i.test(label)) &&
      !/ARTY-TECH/i.test(code),
    levelOf: (code, label) => {
      const m = `${code} ${label}`.match(/L\s*-?\s*([123])/i);
      return m ? `L${m[1]}` : null;
    },
  },
  {
    key: "arty-tech",
    title: "ARTY-TECH",
    family: "technician",
    match: (code) => /ARTY-TECH/i.test(code),
    levelOf: (code, label) => {
      const m = `${code} ${label}`.match(/L\s*-?\s*([123])/i);
      return m ? `L${m[1]}` : null;
    },
  },
  {
    key: "asvy",
    title: "ASVY",
    family: "observation",
    match: (code, label) =>
      /ASVY/i.test(code) || /SURVEY/i.test(label) || /ARTY\s*SVY/i.test(label),
    levelOf: (code, label) => {
      const m = `${code} ${label}`.match(/L\s*-?\s*([123])/i);
      return m ? `L${m[1]}` : null;
    },
  },
  {
    key: "gt",
    title: "GT",
    family: "technician",
    match: (code) => /^GT-L/i.test(code),
    levelOf: (code, label) => {
      const m = `${code} ${label}`.match(/L\s*-?\s*([123])/i);
      return m ? `L${m[1]}` : null;
    },
  },
];

export function resolveNoticeGroup(
  courseCode: string,
  courseName?: string | null
): NoticeGroupMeta & { level: string | null } {
  const display = getCourseDisplayMeta(courseCode, courseName);
  const code = courseCode.toUpperCase();
  const label = display.label.toUpperCase();

  for (const g of LEVEL_GROUPS) {
    if (g.match(code, label)) {
      return {
        key: g.key,
        title: g.title,
        family: g.family,
        hasLevels: true,
        level: g.levelOf(code, label),
      };
    }
  }

  return {
    key: `course-${display.label.toLowerCase()}`,
    title: display.label,
    family: display.family,
    hasLevels: false,
    level: null,
  };
}

export function getLevelGroupMeta(groupKey: string): NoticeGroupMeta | null {
  const found = LEVEL_GROUPS.find((g) => g.key === groupKey);
  if (!found) return null;
  return {
    key: found.key,
    title: found.title,
    family: found.family,
    hasLevels: true,
  };
}

export function isLevelGroupKey(key: string): boolean {
  return LEVEL_GROUPS.some((g) => g.key === key);
}

export type NoticeCourseRow = {
  courseId: number;
  courseCode: string;
  courseName: string;
  durationWeeks: number;
  noticeCount: number;
  exerciseCount: number;
};

export type NoticeFolderItem =
  | {
      kind: "group";
      key: string;
      title: string;
      family: CourseFamily;
      noticeCount: number;
      exerciseCount: number;
      levelCount: number;
      href: string;
    }
  | {
      kind: "course";
      key: string;
      title: string;
      family: CourseFamily;
      courseId: number;
      noticeCount: number;
      exerciseCount: number;
      href: string;
    };

export function buildNoticeFolders(
  courses: NoticeCourseRow[]
): NoticeFolderItem[] {
  const groups = new Map<
    string,
    {
      meta: NoticeGroupMeta;
      courses: NoticeCourseRow[];
    }
  >();

  for (const course of courses) {
    const resolved = resolveNoticeGroup(course.courseCode, course.courseName);
    const existing = groups.get(resolved.key);
    if (existing) {
      existing.courses.push(course);
    } else {
      groups.set(resolved.key, {
        meta: {
          key: resolved.key,
          title: resolved.title,
          family: resolved.family,
          hasLevels: resolved.hasLevels,
        },
        courses: [course],
      });
    }
  }

  const folders: NoticeFolderItem[] = [];

  for (const [key, bundle] of groups) {
    const noticeCount = bundle.courses.reduce(
      (s, c) => s + Number(c.noticeCount || 0),
      0
    );
    const exerciseCount = bundle.courses.reduce(
      (s, c) => s + Number(c.exerciseCount || 0),
      0
    );

    if (bundle.meta.hasLevels && bundle.courses.length >= 1) {
      folders.push({
        kind: "group",
        key,
        title: bundle.meta.title,
        family: bundle.meta.family,
        noticeCount,
        exerciseCount,
        levelCount: bundle.courses.length,
        href: `/course-notices/group/${key}`,
      });
    } else {
      // Same short label (e.g. FAOC / FAOAC) → one folder; prefer exact code match
      const preferred =
        bundle.courses.find(
          (c) => c.courseCode.toUpperCase() === bundle.meta.title.toUpperCase()
        ) ??
        [...bundle.courses].sort(
          (a, b) => Number(b.noticeCount) - Number(a.noticeCount)
        )[0];

      folders.push({
        kind: "course",
        key,
        title: bundle.meta.title,
        family: bundle.meta.family,
        courseId: preferred.courseId,
        noticeCount,
        exerciseCount,
        href: `/course-notices/${preferred.courseId}`,
      });
    }
  }

  return folders.sort((a, b) => a.title.localeCompare(b.title));
}
