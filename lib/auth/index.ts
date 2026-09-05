import { cookies } from "next/headers";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
  verifySessionTokenRaw,
} from "./session";
import type { SessionUser, UserRole } from "./types";

export type { SessionUser, UserRole };
export {
  hashPassword,
  verifyPassword,
  verifySessionToken,
  verifySessionTokenRaw,
};

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user, SESSION_MAX_AGE);
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
