/**
 * CLI backup — same data as Admin → Backup in the UI.
 *
 * Usage:
 *   npm run backup
 *   npm run backup -- --out ~/Desktop/SOFA-BACKUPS
 */

import "dotenv/config";
import { config } from "dotenv";
import path from "path";
import { execSync } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import {
  formatBackupTimestamp,
  writeBackupToFolder,
  createBackupZip,
} from "../lib/utils/backup-core";

config({ path: ".env.local" });

const ROOT = process.cwd();
const DEFAULT_OUT = path.join(process.env.HOME ?? ROOT, "SOFA-BACKUPS");

async function main() {
  const outArg = process.argv.indexOf("--out");
  const baseOut = outArg >= 0 ? process.argv[outArg + 1] : DEFAULT_OUT;
  const backupDir = path.join(baseOut, `backup-${formatBackupTimestamp()}`);

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set. Check .env.local");
    process.exit(1);
  }

  console.log("SOFA2 Backup starting...");
  console.log(`Output: ${backupDir}`);

  await mkdir(baseOut, { recursive: true });
  const manifest = await writeBackupToFolder(ROOT, backupDir);

  const zipBuffer = await createBackupZip(ROOT);
  const archivePath = `${backupDir}.zip`;
  await writeFile(archivePath, zipBuffer);

  try {
    execSync(`tar -czf "${backupDir}.tar.gz" -C "${baseOut}" "${path.basename(backupDir)}"`, {
      stdio: "pipe",
    });
    console.log(`\n✅ Archive: ${backupDir}.tar.gz`);
  } catch {
    // tar optional
  }

  console.log(`\n✅ Backup complete!`);
  console.log(`   Folder: ${backupDir}`);
  console.log(`   Zip:    ${archivePath}`);
  console.log(`   Tables: ${manifest.tables.length} | Rows: ${manifest.totalRows}`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
