/**
 * CLI restore — same data as Admin → Backup in the UI.
 *
 * Usage:
 *   npm run restore -- ~/SOFA-BACKUPS/backup-2026-08-29_19-30-00
 */

import "dotenv/config";
import { config } from "dotenv";
import path from "path";
import readline from "readline";
import { restoreFromFolder } from "../lib/utils/backup-core";

config({ path: ".env.local" });

async function confirm(message: string): Promise<boolean> {
  if (process.argv.includes("--yes")) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    });
  });
}

async function main() {
  const backupDir = process.argv[2];

  if (!backupDir) {
    console.error("Usage: npm run restore -- <backup-folder-path>");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set. Check .env.local");
    process.exit(1);
  }

  const resolved = path.resolve(backupDir);
  const ok = await confirm(
    `Restore from ${resolved}? This will REPLACE current data.`
  );
  if (!ok) {
    console.log("Restore cancelled.");
    process.exit(0);
  }

  const manifest = await restoreFromFolder(process.cwd(), resolved);
  console.log(`\n✅ Restored ${manifest.totalRows} rows.`);
}

main().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
