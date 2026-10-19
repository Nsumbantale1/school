import dns from "node:dns";
import net from "node:net";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { Agent, fetch as undiciFetch } from "undici";
import * as schema from "./schema";

// Prefer IPv4 — IPv6 to Neon often fails with ENETUNREACH on this network
dns.setDefaultResultOrder("ipv4first");
// Node's default 500 ms per-address connect window is shorter than this
// network's TCP connect time, making every Neon IP fail with ETIMEDOUT.
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);

// A fresh TLS connection to Neon costs 1–6 s on this network, and Node's
// fetch drops idle sockets after 4 s. Keeping them longer helps, but this
// network silently kills idle TCP connections after roughly 20–30 s, and a
// request sent on such a socket hangs until a timeout fires. So: reuse for
// 10 s only, probe with TCP keep-alive, and fail fast so the retry reconnects.
const globalForDb = globalThis as unknown as { neonAgentV2?: Agent };

function createNeonAgent() {
  return new Agent({
    keepAliveTimeout: 10_000,
    keepAliveMaxTimeout: 10_000,
    connections: 16,
    connect: { timeout: 15_000, keepAlive: true, keepAliveInitialDelay: 5_000 },
    headersTimeout: 12_000,
    bodyTimeout: 20_000,
  });
}

let neonAgent = globalForDb.neonAgentV2 ?? createNeonAgent();
globalForDb.neonAgentV2 = neonAgent;
let lastAgentReplace = 0;

/** Drop a pool of dead keep-alive sockets so the next attempt dials fresh. */
function replaceNeonAgent() {
  const now = Date.now();
  if (now - lastAgentReplace < 1000) return;
  lastAgentReplace = now;
  const previous = neonAgent;
  neonAgent = createNeonAgent();
  globalForDb.neonAgentV2 = neonAgent;
  void previous.destroy().catch(() => {});
}

// A response can die mid-body (stale keep-alive socket after sleep/network
// change). Retrying then is only safe for reads: a write may have committed.
function isReadOnlyRequest(init?: RequestInit): boolean {
  if (typeof init?.body !== "string") return false;
  try {
    const parsed = JSON.parse(init.body);
    const queries: { query?: unknown }[] = Array.isArray(parsed?.queries)
      ? parsed.queries
      : [parsed];
    return (
      queries.length > 0 &&
      queries.every(
        (q) => typeof q?.query === "string" && /^\s*select\b/i.test(q.query)
      )
    );
  } catch {
    return false;
  }
}

const RETRYABLE_HTTP = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_PG = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "57P01",
  "57P02",
  "57P03",
  "40001",
  "40P01",
  "53300",
  "55P03",
]);

function responseFrom(res: Response, body: ArrayBuffer) {
  const headers = new Headers();
  res.headers.forEach((value, key) => {
    if (
      key === "content-encoding" ||
      key === "content-length" ||
      key === "transfer-encoding"
    ) {
      return;
    }
    headers.append(key, value);
  });
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/** Neon often answers a dead compute with HTTP 5xx instead of a thrown fetch. */
function readRetryReason(status: number, body: ArrayBuffer): string | null {
  const text = new TextDecoder().decode(body).trim();
  if (RETRYABLE_HTTP.has(status)) {
    return `HTTP ${status}: ${text.slice(0, 300)}`;
  }
  if (status === 400 && text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as { code?: string; message?: string };
      if (parsed.code && RETRYABLE_PG.has(parsed.code)) {
        return `Postgres ${parsed.code}: ${parsed.message ?? ""}`.slice(0, 300);
      }
    } catch {
      return null;
    }
  }
  if (
    status >= 200 &&
    status < 300 &&
    text.length > 0 &&
    !text.startsWith("{") &&
    !text.startsWith("[")
  ) {
    return `Unreadable database response: ${text.slice(0, 180)}`;
  }
  return null;
}

neonConfig.fetchFunction = async (
  input: RequestInfo | URL,
  init?: RequestInit
) => {
  const attempts = 5;
  const readOnly = isReadOnlyRequest(init);
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = (await undiciFetch(
        input as Parameters<typeof undiciFetch>[0],
        { ...(init as Parameters<typeof undiciFetch>[1]), dispatcher: neonAgent }
      )) as unknown as Response;
      if (!readOnly) return res;
      const body = await res.arrayBuffer();
      const retryReason = readRetryReason(res.status, body);
      if (retryReason && i < attempts) {
        lastError = new Error(retryReason);
        replaceNeonAgent();
        await new Promise((r) => setTimeout(r, 1500 * i));
        continue;
      }
      if (retryReason) {
        console.error("Database read failed after retries:", retryReason);
      }
      return responseFrom(res, body);
    } catch (error) {
      lastError = error;
      replaceNeonAgent();
      if (i === attempts) break;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw lastError;
};

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
