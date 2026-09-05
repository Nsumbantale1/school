/**
 * Session token security tests (HMAC + expiry).
 * Uses a temporary SESSION_SECRET for isolation.
 */
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";

describe("session tokens", () => {
  before(() => {
    process.env.SESSION_SECRET =
      "unit-test-session-secret-at-least-32-chars-long!!";
    process.env.NODE_ENV = "test";
  });

  it("accepts valid tokens and rejects tampering", async () => {
    const { createSessionToken, verifySessionToken } = await import(
      "../lib/auth/session"
    );

    const token = await createSessionToken(
      {
        userId: 7,
        username: "alice",
        name: "Alice",
        role: "viewer",
        assignedCourseId: null,
      },
      3600
    );

    const user = await verifySessionToken(token);
    assert.ok(user);
    assert.equal(user!.userId, 7);
    assert.equal(user!.role, "viewer");

    const [payload, sig] = token.split(".");
    const tampered = `${payload}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`;
    assert.equal(await verifySessionToken(tampered), null);

    const forgedPayload = Buffer.from(
      JSON.stringify({
        userId: 1,
        username: "admin",
        name: "Admin",
        role: "admin",
        exp: Date.now() + 999999,
      })
    ).toString("base64");
    assert.equal(await verifySessionToken(`${forgedPayload}.${sig}`), null);
  });

  it("rejects expired tokens", async () => {
    const { createSessionToken, verifySessionToken } = await import(
      "../lib/auth/session"
    );
    const token = await createSessionToken(
      {
        userId: 3,
        username: "bob",
        name: "Bob",
        role: "instructor",
        assignedCourseId: 1,
      },
      -1
    );
    assert.equal(await verifySessionToken(token), null);
  });
});
