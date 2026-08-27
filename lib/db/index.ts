import dns from "node:dns";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Prefer IPv4 — IPv6 to Neon often fails with ENETUNREACH on this network
dns.setDefaultResultOrder("ipv4first");

neonConfig.fetchFunction = async (
  input: RequestInfo | URL,
  init?: RequestInit
) => {
  const attempts = 5;
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (i === attempts) break;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw lastError;
};

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
