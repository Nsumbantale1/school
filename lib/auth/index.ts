import { cookies } from "next/headers";

export type UserRole = "admin" | "instructor" | "viewer";

export interface SessionUser {
  userId: number;
  username: string;
  name: string;
  role: UserRole;
  assignedCourseId?: number | null;
}

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is required");
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
  return expected === signature;
}

// Password hashing using PBKDF2 (edge-compatible)
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
  return hashStr === storedHash;
}

// Session token: base64(json payload).signature
async function createSessionToken(user: SessionUser): Promise<string> {
  const payload = JSON.stringify({
    ...user,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  });
  const encoded = btoa(payload);
  const sig = await hmacSign(encoded);
  return `${encoded}.${sig}`;
}

async function verifySessionToken(token: string): Promise<SessionUser | null> {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const valid = await hmacVerify(encoded, sig);
  if (!valid) return null;
  try {
    const data = JSON.parse(atob(encoded));
    if (data.exp < Date.now()) return null;
    return {
      userId: data.userId,
      username: data.username,
      name: data.name,
      role: data.role,
      assignedCourseId: data.assignedCourseId,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Lightweight token verification for middleware (no cookies() API)
export async function verifySessionTokenRaw(token: string): Promise<boolean> {
  const user = await verifySessionToken(token);
  return user !== null;
}
