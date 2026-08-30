import { neon } from "@neondatabase/serverless";
import { readdir, readFile, stat, writeFile, mkdir } from "fs/promises";
import path from "path";
import { ZipArchive } from "archiver";
import AdmZip from "adm-zip";
import { PassThrough } from "stream";

export const BACKUP_VERSION = 1;

export interface BackupManifest {
  version: number;
  createdAt: string;
  tables: string[];
  totalRows: number;
  databaseUrlHost: string;
  files: {
    signatures: boolean;
    publicAssets: number;
  };
}

export interface BackupBundle {
  manifest: BackupManifest;
  database: Record<string, Record<string, unknown>[]>;
  fileBuffers: Record<string, Buffer>;
  envSnapshot?: string;
}

const RESTORE_ORDER = [
  "users",
  "students",
  "courses",
  "course_notices",
  "course_exercises",
  "course_subjects",
  "course_intakes",
  "course_prerequisites",
  "enrollments",
  "results",
  "documents",
  "official_signatures",
  "certificates",
  "audit_logs",
  "login_logs",
];

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  return neon(url);
}

export function formatBackupTimestamp(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function listTables(sql: ReturnType<typeof neon>): Promise<string[]> {
  const rows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return rows.map((r) => String(r.table_name));
}

async function dumpTable(
  sql: ReturnType<typeof neon>,
  table: string
): Promise<Record<string, unknown>[]> {
  return (await sql.query(`SELECT * FROM "${table}"`)) as Record<
    string,
    unknown
  >[];
}

async function readPublicAssets(root: string): Promise<Record<string, Buffer>> {
  const publicDir = path.join(root, "public");
  const files: Record<string, Buffer> = {};
  const entries = await readdir(publicDir);

  for (const file of entries) {
    if (file === "signatures") continue;
    const src = path.join(publicDir, file);
    const info = await stat(src);
    if (info.isFile()) {
      files[`files/public/${file}`] = await readFile(src);
    }
  }
  return files;
}

async function readSignatureFiles(root: string): Promise<Record<string, Buffer>> {
  const sigDir = path.join(root, "public", "signatures");
  const files: Record<string, Buffer> = {};

  try {
    const entries = await readdir(sigDir);
    for (const file of entries) {
      if (file.startsWith(".")) continue;
      const src = path.join(sigDir, file);
      const info = await stat(src);
      if (info.isFile()) {
        files[`files/signatures/${file}`] = await readFile(src);
      }
    }
  } catch {
    // no signatures folder
  }

  return files;
}

export async function createBackupBundle(root: string): Promise<BackupBundle> {
  const sql = getSql();
  const tables = await listTables(sql);
  const database: Record<string, Record<string, unknown>[]> = {};
  let totalRows = 0;

  for (const table of tables) {
    const rows = await dumpTable(sql, table);
    database[table] = rows;
    totalRows += rows.length;
  }

  let envSnapshot: string | undefined;
  try {
    envSnapshot = await readFile(path.join(root, ".env.local"), "utf-8");
  } catch {
    // optional
  }

  const sigFiles = await readSignatureFiles(root);
  const publicFiles = await readPublicAssets(root);
  const fileBuffers = { ...sigFiles, ...publicFiles };

  const manifest: BackupManifest = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    tables,
    totalRows,
    databaseUrlHost: (() => {
      try {
        return new URL(process.env.DATABASE_URL!).host;
      } catch {
        return "unknown";
      }
    })(),
    files: {
      signatures: Object.keys(sigFiles).length > 0,
      publicAssets: Object.keys(publicFiles).length,
    },
  };

  return { manifest, database, fileBuffers, envSnapshot };
}

export async function createBackupZip(root: string): Promise<Buffer> {
  const bundle = await createBackupBundle(root);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    archive.on("error", reject);
  });

  archive.pipe(stream);

  archive.append(JSON.stringify(bundle.manifest, null, 2), {
    name: "manifest.json",
  });

  for (const [table, rows] of Object.entries(bundle.database)) {
    archive.append(JSON.stringify(rows, null, 2), {
      name: `database/${table}.json`,
    });
  }

  if (bundle.envSnapshot) {
    archive.append(bundle.envSnapshot, { name: "env.local.snapshot" });
  }

  for (const [entryName, buffer] of Object.entries(bundle.fileBuffers)) {
    archive.append(buffer, { name: entryName });
  }

  await archive.finalize();
  return done;
}

export function parseBackupZip(buffer: Buffer): {
  manifest: BackupManifest;
  database: Record<string, Record<string, unknown>[]>;
  files: Record<string, Buffer>;
  envSnapshot?: string;
} {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  let manifest: BackupManifest | null = null;
  const database: Record<string, Record<string, unknown>[]> = {};
  const files: Record<string, Buffer> = {};
  let envSnapshot: string | undefined;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;

    if (name === "manifest.json") {
      manifest = JSON.parse(entry.getData().toString("utf-8")) as BackupManifest;
      continue;
    }

    if (name.startsWith("database/") && name.endsWith(".json")) {
      const table = path.basename(name, ".json");
      database[table] = JSON.parse(entry.getData().toString("utf-8")) as Record<
        string,
        unknown
      >[];
      continue;
    }

    if (name === "env.local.snapshot") {
      envSnapshot = entry.getData().toString("utf-8");
      continue;
    }

    if (name.startsWith("files/")) {
      files[name] = entry.getData();
    }
  }

  if (!manifest) {
    throw new Error("Invalid backup file: manifest.json is missing.");
  }

  return { manifest, database, files, envSnapshot };
}

export async function restoreBackup(
  root: string,
  backup: {
    database: Record<string, Record<string, unknown>[]>;
    files: Record<string, Buffer>;
    envSnapshot?: string;
  }
) {
  const sql = getSql();
  const tableNames = Object.keys(backup.database);

  const ordered = [
    ...RESTORE_ORDER.filter((t) => tableNames.includes(t)),
    ...tableNames.filter((t) => !RESTORE_ORDER.includes(t)),
  ];

  for (const table of ordered) {
    const rows = backup.database[table] ?? [];
    await sql.query(`TRUNCATE TABLE "${table}" CASCADE`);

    if (rows.length === 0) continue;

    const columns = Object.keys(rows[0]);
    const colList = columns.map((c) => `"${c}"`).join(", ");

    for (const row of rows) {
      const values = columns.map((c) => row[c]);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
      await sql.query(
        `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
        values
      );
    }
  }

  for (const [entryName, buffer] of Object.entries(backup.files)) {
    const dest = path.join(root, "public", entryName.replace(/^files\//, ""));
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
  }

  if (backup.envSnapshot) {
    await writeFile(path.join(root, ".env.local"), backup.envSnapshot, "utf-8");
  }
}

export async function writeBackupToFolder(root: string, outDir: string) {
  const bundle = await createBackupBundle(root);

  await mkdir(path.join(outDir, "database"), { recursive: true });

  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(bundle.manifest, null, 2),
    "utf-8"
  );

  for (const [table, rows] of Object.entries(bundle.database)) {
    await writeFile(
      path.join(outDir, "database", `${table}.json`),
      JSON.stringify(rows, null, 2),
      "utf-8"
    );
  }

  if (bundle.envSnapshot) {
    await writeFile(
      path.join(outDir, "env.local.snapshot"),
      bundle.envSnapshot,
      "utf-8"
    );
  }

  for (const [entryName, buffer] of Object.entries(bundle.fileBuffers)) {
    const dest = path.join(outDir, entryName);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
  }

  return bundle.manifest;
}

export async function restoreFromFolder(root: string, backupDir: string) {
  const manifest = JSON.parse(
    await readFile(path.join(backupDir, "manifest.json"), "utf-8")
  ) as BackupManifest;

  const database: Record<string, Record<string, unknown>[]> = {};
  for (const table of manifest.tables) {
    const filePath = path.join(backupDir, "database", `${table}.json`);
    try {
      database[table] = JSON.parse(await readFile(filePath, "utf-8")) as Record<
        string,
        unknown
      >[];
    } catch {
      database[table] = [];
    }
  }

  const files: Record<string, Buffer> = {};
  const collectFiles = async (dir: string, prefix: string) => {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = `${prefix}/${entry.name}`;
        if (entry.isDirectory()) {
          await collectFiles(full, rel);
        } else if (entry.isFile()) {
          files[rel] = await readFile(full);
        }
      }
    } catch {
      // optional folder
    }
  };

  await collectFiles(path.join(backupDir, "files"), "files");

  let envSnapshot: string | undefined;
  try {
    envSnapshot = await readFile(
      path.join(backupDir, "env.local.snapshot"),
      "utf-8"
    );
  } catch {
    // optional
  }

  await restoreBackup(root, { database, files, envSnapshot });
  return manifest;
}
