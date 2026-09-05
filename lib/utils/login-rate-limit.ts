/**
 * Simple in-memory login rate limit (per process).
 * For multi-instance production, replace with Redis.
 */

const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function getClientKey(ip: string, username: string): string {
  return `${ip}|${username.toLowerCase()}`;
}

export function checkLoginRateLimit(key: string): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  const row = attempts.get(key);
  if (!row || now > row.resetAt) {
    return { allowed: true };
  }
  if (row.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((row.resetAt - now) / 1000),
    };
  }
  return { allowed: true };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const row = attempts.get(key);
  if (!row || now > row.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  row.count += 1;
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}

/** Test helper */
export function __resetLoginRateLimitForTests(): void {
  attempts.clear();
}
