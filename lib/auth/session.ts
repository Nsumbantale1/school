import { timingSafeEqualString } from "@/lib/utils/security-path";
import { isUserRole, type SessionUser, type UserRole } from "./types";

export type { SessionUser, UserRole };

const WEAK_SECRETS = new Set([
  "artillery-school-secret-key-change-in-production-2024",
  "secret",
  "changeme",
  "session-secret",
]);

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is required");
  if (
    process.env.NODE_ENV === "production" &&
    (WEAK_SECRETS.has(secret) || secret.length < 32)
  ) {
    throw new Error(
      "SESSION_SECRET is weak or default. Set a random secret (>= 32 chars) before production use."
    );
  }
  return secret;
}

async function hmacSign(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function hmacVerify(payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(payload);
  return timingSafeEqualString(expected, signature);
}

export async function createSessionToken(
  user: SessionUser,
  maxAgeSec: number
): Promise<string> {
  const payload = JSON.stringify({
    ...user,
    exp: Date.now() + maxAgeSec * 1000,
  });
  const encoded = btoa(payload);
  const sig = await hmacSign(encoded);
  return `${encoded}.${sig}`;
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const valid = await hmacVerify(encoded, sig);
  if (!valid) return null;
  try {
    const data = JSON.parse(atob(encoded));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (
      typeof data.userId !== "number" ||
      typeof data.username !== "string" ||
      typeof data.role !== "string"
    ) {
      return null;
    }
    const role = data.role as UserRole;
    if (!isUserRole(role)) {
      return null;
    }
    return {
      userId: data.userId,
      username: data.username,
      name: typeof data.name === "string" ? data.name : data.username,
      role,
      assignedCourseId:
        typeof data.assignedCourseId === "number"
          ? data.assignedCourseId
          : null,
    };
  } catch {
    return null;
  }
}

export async function verifySessionTokenRaw(token: string): Promise<boolean> {
  return (await verifySessionToken(token)) !== null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltStr = btoa(String.fromCharCode(...salt));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashStr = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `${saltStr}:${hashStr}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [saltStr, storedHash] = stored.split(":");
  if (!saltStr || !storedHash) return false;
  const salt = Uint8Array.from(atob(saltStr), (c) => c.charCodeAt(0));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashStr = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return timingSafeEqualString(hashStr, storedHash);
}
