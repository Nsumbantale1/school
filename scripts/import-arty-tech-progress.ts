import { loadEnvConfig } from "@next/env";
import { inArray } from "drizzle-orm";

loadEnvConfig(process.cwd());

type Block = {
  enrollmentId: number;
  weekly: number[];
  monthly: number[];
};

/** Twelve cells: weeks 1–9 and M-1–M-3, then M-4. Weeks 10–15 and M-5 are blank on the sheet. */
const ROWS: Block[] = [
  { enrollmentId: 1320, weekly: [60, 78, 60, 77, 78.5, 83, 73, 87, 69], monthly: [55, 83, 74, 63] },
  { enrollmentId: 1321, weekly: [66, 75, 55, 72, 68.5, 71, 48, 69, 58.5], monthly: [42, 71, 55.5, 57] },
  { enrollmentId: 1322, weekly: [54.5, 74, 69, 67.5, 74.5, 80.5, 69.5, 78, 60], monthly: [45, 80.5, 56, 88] },
  { enrollmentId: 1323, weekly: [65, 83, 70, 59, 62, 70, 63, 57, 73], monthly: [32, 70, 40, 75] },
  { enrollmentId: 1324, weekly: [86, 83, 93, 82, 77, 74, 78, 58, 64], monthly: [56, 74, 71, 60] },
  { enrollmentId: 1325, weekly: [44.5, 79, 64, 67, 57.5, 61, 56, 77, 55], monthly: [33, 61, 33, 60] },
  { enrollmentId: 1326, weekly: [67.5, 73, 79, 79, 79, 86, 58.5, 76, 79], monthly: [65.5, 86, 63, 70] },
  { enrollmentId: 1327, weekly: [80, 82, 85, 70, 74.5, 70.5, 45, 71, 79], monthly: [55, 70.5, 57, 66] },
  { enrollmentId: 1328, weekly: [60.5, 63, 71, 69, 59.5, 51, 15, 66, 60], monthly: [44, 51, 38, 66] },
  { enrollmentId: 1329, weekly: [69, 85, 75, 70, 65.5, 88, 56, 75, 76], monthly: [70.5, 88, 62, 66] },
  { enrollmentId: 1330, weekly: [84, 79, 80, 71, 67.5, 78.5, 78, 85, 66], monthly: [70, 78.5, 77, 78] },
  { enrollmentId: 1331, weekly: [65.5, 86, 76, 85.5, 77, 79, 78, 92, 79], monthly: [68, 79, 84, 82] },
  { enrollmentId: 1332, weekly: [39, 77, 57, 60.5, 61, 61, 38, 62, 69], monthly: [37, 61, 56, 68] },
  { enrollmentId: 1333, weekly: [76.5, 91, 79, 84, 81, 74.5, 76, 84, 93], monthly: [65, 74, 75, 83] },
  { enrollmentId: 1334, weekly: [84.5, 79, 98, 85, 75.5, 75.5, 81, 81, 95], monthly: [56, 75.5, 68, 83] },
  { enrollmentId: 1335, weekly: [75, 88, 92, 88, 83, 75, 88, 68, 83], monthly: [73, 75, 83, 79] },
  { enrollmentId: 1336, weekly: [69, 86, 70.5, 79, 55, 82.5, 64, 82, 80], monthly: [50, 82.5, 68, 82] },
  { enrollmentId: 1337, weekly: [59.5, 74, 74, 79, 75.5, 81.5, 83, 79, 80], monthly: [62.5, 81.5, 77, 82] },
];

async function main() {
  const { db } = await import("../lib/db");
  const { progressTests } = await import("../lib/db/schema");
  const { ensureProgressTestsTable } = await import("../lib/db/ensure-progress-tests");
  await ensureProgressTestsTable();

  const ids = ROWS.map((row) => row.enrollmentId);
  await db.delete(progressTests).where(inArray(progressTests.enrollmentId, ids));

  const values = ROWS.flatMap((row) => {
    const weekly = row.weekly.map((marks, index) => ({
      enrollmentId: row.enrollmentId,
      kind: "week",
      period: index + 1,
      marks: marks.toFixed(2),
    }));
    const monthly = row.monthly.map((marks, index) => ({
      enrollmentId: row.enrollmentId,
      kind: "month",
      period: index + 1,
      marks: marks.toFixed(2),
    }));
    return [...weekly, ...monthly];
  });

  await db.insert(progressTests).values(values);
  console.log(`Inserted ${values.length} marks for ${ROWS.length} students`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
