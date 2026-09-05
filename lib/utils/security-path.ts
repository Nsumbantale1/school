import path from "path";

/**
 * Resolve a path under `root` and reject traversal outside that root.
 * Returns null if the resolved path escapes the jail.
 */
export function resolveUnderRoot(
  root: string,
  ...segments: string[]
): string | null {
  const rootResolved = path.resolve(root);
  const candidate = path.resolve(rootResolved, ...segments);
  const rel = path.relative(rootResolved, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  return candidate;
}

/** Strip zip entry prefixes and reject absolute / traversal paths. */
export function sanitizeBackupEntryName(entryName: string): string | null {
  const normalized = entryName.replace(/\\/g, "/").trim();
  if (
    !normalized ||
    normalized.includes("\0") ||
    /^(\/|[a-zA-Z]:)/.test(normalized)
  ) {
    return null;
  }

  let name = normalized;
  while (name.startsWith("files/")) {
    name = name.slice("files/".length);
  }
  if (!name || name.includes("..")) return null;

  const parts = name.split("/").filter((p) => p.length > 0);
  if (parts.length === 0 || parts.some((p) => p === "." || p === "..")) {
    return null;
  }
  return parts.join("/");
}

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

export function extensionForMime(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null;
}

/** Timing-safe equality for base64/ascii strings (Web Crypto / Node). */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
