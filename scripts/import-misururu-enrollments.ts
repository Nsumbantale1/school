/**
 * Enroll students from MISURURU (course roll) Word documents.
 *
 * Usage:
 *   npx tsx scripts/import-misururu-enrollments.ts
 *   npx tsx scripts/import-misururu-enrollments.ts /path/to/MISURURU
 *   npx tsx scripts/import-misururu-enrollments.ts --dry-run
 */

import "dotenv/config";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { courses, courseIntakes, students, enrollments } from "../lib/db/schema";

config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");
const args = process.argv.slice(2).filter((a) => a !== "--dry-run");

const DEFAULT_DIR = path.join(process.env.HOME ?? "", "Desktop/CV-2/MISURURU");

type RollStudent = {
  armyNumber: string;
  rank: string;
  fullName: string;
  unit: string;
};

type RollMeta = {
  courseCode: string;
  courseName: string;
  intakeNumber: string;
  year: number;
  startDate: string;
  durationWeeks: number;
};

const COURSE_MAP: Array<{
  match: RegExp;
  code: string;
  name: string;
  weeks: number;
}> = [
  {
    match: /AAT\s*C?\s*L\s*-?\s*3|AATC\s*L\s*-?\s*3/,
    code: "AAT-L3",
    name: "Artillery Armament Technician Level 3",
    weeks: 26,
  },
  {
    match: /ARTY\s*TECH\s*L\s*-?\s*1|ARTY-TECH-L1/,
    code: "ARTY-TECH-L1",
    name: "Artillery Technician Level 1",
    weeks: 26,
  },
  {
    match: /\bFAOA\b|\bFAOAC\b|\bFAOC\b/,
    code: "FAOC",
    name: "Field Artillery Officers Course",
    weeks: 26,
  },
  {
    match: /\bOBG\b|\bOBGC\b/,
    code: "OBGC",
    name: "Observation Battery Gunners Course",
    weeks: 26,
  },
  {
    match: /\bROG\b|\bROGC\b/,
    code: "ROGC",
    name: "Regimental Officers Gunnery Course",
    weeks: 26,
  },
];

function normalizeArmyNumber(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 20);
}

function titleCaseRank(raw: string): string {
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) return compact;
  const upper = compact.toUpperCase().replace(/[^A-Z]/g, "");
  const map: Record<string, string> = {
    PTE: "Pte",
    CPL: "Cpl",
    LCPL: "LCpl",
    SGT: "Sgt",
    SSGT: "SSgt",
    LS: "LS",
    WO: "WO",
    WOI: "WOI",
    WOII: "WOII",
    WO2: "WOII",
    LT: "Lt",
    CAPT: "Capt",
    MAJ: "Maj",
    COL: "Col",
  };
  if (map[upper]) return map[upper];
  return compact
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function parseDocx(filePath: string): {
  paragraphs: string[];
  tables: string[][][];
} {
  const zip = new AdmZip(filePath);
  const entry = zip.getEntry("word/document.xml");
  if (!entry) throw new Error(`No document.xml in ${filePath}`);
  const xml = entry.getData().toString("utf8");

  const paragraphs: string[] = [];
  const pRe = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(xml))) {
    const texts = [...pm[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) =>
      decodeXmlEntities(m[1])
    );
    const s = texts.join("").replace(/\s+/g, " ").trim();
    if (s) paragraphs.push(s);
  }

  const tables: string[][][] = [];
  const tblRe = /<w:tbl[\s>][\s\S]*?<\/w:tbl>/g;
  let tm: RegExpExecArray | null;
  while ((tm = tblRe.exec(xml))) {
    const rows: string[][] = [];
    const trRe = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
    let trm: RegExpExecArray | null;
    while ((trm = trRe.exec(tm[0]))) {
      const cells: string[] = [];
      const tcRe = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
      let tcm: RegExpExecArray | null;
      while ((tcm = tcRe.exec(trm[0]))) {
        const texts = [...tcm[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(
          (m) => decodeXmlEntities(m[1])
        );
        cells.push(texts.join("").replace(/\s+/g, " ").trim());
      }
      if (cells.some((c) => c)) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }

  return { paragraphs, tables };
}

function parseIntakeFromTitle(title: string): {
  intakeNumber: string;
  year: number;
} | null {
  // e.g. 07/26-27 → 07-26-27 · 09/26 → 09-26 · 26/26-27 → 26-26-27
  const m = title.match(
    /(\d{1,3})\s*[/\\-]\s*(\d{2})(?:\s*[-–]\s*(\d{2}))?/i
  );
  if (!m) return null;
  const intakeNumber = m[3] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}`;
  const yy = parseInt(m[2], 10);
  const year = yy >= 90 ? 1900 + yy : 2000 + yy;
  return { intakeNumber, year };
}

function resolveMeta(filename: string, paragraphs: string[]): RollMeta {
  const blob = `${filename}\n${paragraphs.join("\n")}`.toUpperCase();
  const title =
    paragraphs.find((p) => /MSURURU|KOZI YA|INT\s*\d/i.test(p)) ?? filename;

  const course = COURSE_MAP.find((c) => c.match.test(blob));
  if (!course) {
    throw new Error(`Cannot resolve course from: ${filename} / ${title}`);
  }

  const intake = parseIntakeFromTitle(title) ?? parseIntakeFromTitle(filename);
  if (!intake) throw new Error(`Cannot parse intake from: ${title}`);

  return {
    courseCode: course.code,
    courseName: course.name,
    intakeNumber: intake.intakeNumber,
    year: intake.year,
    startDate: `${intake.year}-01-15`,
    durationWeeks: course.weeks,
  };
}

function parseStudents(tables: string[][][]): RollStudent[] {
  const armyRe = /^(P|MT|N)\s*\d{3,}/i;
  const best = [...tables].sort((a, b) => b.length - a.length)[0] ?? [];
  const out: RollStudent[] = [];
  const seen = new Set<string>();

  for (const row of best) {
    const armyIdx = row.findIndex((c) => armyRe.test(c));
    if (armyIdx < 0) continue;
    const armyNumber = normalizeArmyNumber(row[armyIdx]);
    if (seen.has(armyNumber)) continue;
    const rank = titleCaseRank(row[armyIdx + 1] ?? "");
    const fullName = (row[armyIdx + 2] ?? "").replace(/\s+/g, " ").trim();
    const unit = (row[armyIdx + 3] ?? "").replace(/\s+/g, " ").trim();
    if (!fullName || fullName.length < 2) continue;
    seen.add(armyNumber);
    out.push({ armyNumber, rank: rank || "Pte", fullName, unit });
  }
  return out;
}

async function ensureCourse(meta: RollMeta): Promise<number> {
  const [existing] = await db
    .select()
    .from(courses)
    .where(eq(courses.courseCode, meta.courseCode))
    .limit(1);
  if (existing) return existing.courseId;

  const [created] = await db
    .insert(courses)
    .values({
      courseCode: meta.courseCode,
      courseName: meta.courseName,
      description: `${meta.courseName}. Created from MISURURU enrollment list.`,
      durationWeeks: meta.durationWeeks,
      passingMark: 50,
      isActive: true,
    })
    .returning({ courseId: courses.courseId });
  return created.courseId;
}

async function ensureIntake(courseId: number, meta: RollMeta): Promise<number> {
  const [existing] = await db
    .select()
    .from(courseIntakes)
    .where(
      and(
        eq(courseIntakes.courseId, courseId),
        eq(courseIntakes.intakeNumber, meta.intakeNumber)
      )
    )
    .limit(1);
  if (existing) {
    await db
      .update(courseIntakes)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(courseIntakes.intakeId, existing.intakeId));
    return existing.intakeId;
  }
  const [created] = await db
    .insert(courseIntakes)
    .values({
      courseId,
      intakeNumber: meta.intakeNumber,
      year: meta.year,
      startDate: meta.startDate,
      endDate: null,
      isActive: true,
    })
    .returning({ intakeId: courseIntakes.intakeId });
  return created.intakeId;
}

async function upsertEnrollment(
  intakeId: number,
  student: RollStudent
): Promise<"created" | "updated"> {
  const [existingStudent] = await db
    .select({ armyNumber: students.armyNumber })
    .from(students)
    .where(eq(students.armyNumber, student.armyNumber))
    .limit(1);

  if (existingStudent) {
    await db
      .update(students)
      .set({
        fullName: student.fullName,
        rank: student.rank,
        unit: student.unit || null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(students.armyNumber, student.armyNumber));
  } else {
    await db.insert(students).values({
      armyNumber: student.armyNumber,
      fullName: student.fullName,
      rank: student.rank,
      gender: "male",
      unit: student.unit || null,
      isActive: true,
    });
  }

  const [existingEnrollment] = await db
    .select({ enrollmentId: enrollments.enrollmentId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentArmyNumber, student.armyNumber),
        eq(enrollments.intakeId, intakeId)
      )
    )
    .limit(1);

  if (existingEnrollment) {
    await db
      .update(enrollments)
      .set({
        rankAtEnrollment: student.rank,
        unitAtEnrollment: student.unit || null,
        updatedAt: new Date(),
      })
      .where(eq(enrollments.enrollmentId, existingEnrollment.enrollmentId));
    return "updated";
  }

  await db.insert(enrollments).values({
    studentArmyNumber: student.armyNumber,
    intakeId,
    rankAtEnrollment: student.rank,
    unitAtEnrollment: student.unit || null,
    status: "enrolled",
  });
  return "created";
}

async function main() {
  if (!process.env.DATABASE_URL && !dryRun) {
    console.error("DATABASE_URL is missing. Check .env.local");
    process.exit(1);
  }

  const target = args[0] || DEFAULT_DIR;
  if (!fs.existsSync(target)) {
    console.error("Folder not found:", target);
    process.exit(1);
  }

  const files = fs
    .readdirSync(target)
    .filter((n) => n.toLowerCase().endsWith(".docx") && !n.startsWith("~$"))
    .map((n) => path.join(target, n))
    .sort();

  if (files.length === 0) {
    console.error("No .docx files in", target);
    process.exit(1);
  }

  console.log(dryRun ? "Dry run (no database writes)" : "Enrolling into SOFA");
  console.log("Source:", target);
  console.log(`Files: ${files.length}\n`);

  for (const file of files) {
    const filename = path.basename(file);
    try {
      const { paragraphs, tables } = parseDocx(file);
      const meta = resolveMeta(filename, paragraphs);
      const roll = parseStudents(tables);

      console.log(
        `${filename}: ${meta.courseCode} intake ${meta.intakeNumber} · ${roll.length} students · year ${meta.year}`
      );

      if (roll.length === 0) {
        console.log("  warning: no students parsed — skipped");
        continue;
      }

      if (dryRun) {
        for (const s of roll.slice(0, 3)) {
          console.log(`  e.g. ${s.armyNumber} ${s.rank} ${s.fullName}`);
        }
        continue;
      }

      const courseId = await ensureCourse(meta);
      const intakeId = await ensureIntake(courseId, meta);
      let created = 0;
      let updated = 0;
      for (const s of roll) {
        const result = await upsertEnrollment(intakeId, s);
        if (result === "created") created += 1;
        else updated += 1;
      }
      console.log(
        `  enrolled ${created} new, updated ${updated} (intake id ${intakeId})`
      );
    } catch (error) {
      console.error(`${filename}: FAILED — ${(error as Error).message}`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
