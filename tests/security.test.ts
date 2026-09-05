import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "path";
import {
  resolveUnderRoot,
  sanitizeBackupEntryName,
  extensionForMime,
  timingSafeEqualString,
} from "../lib/utils/security-path";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  __resetLoginRateLimitForTests,
} from "../lib/utils/login-rate-limit";
import { canManageResultsForCourse } from "../lib/auth/permissions";
import type { SessionUser } from "../lib/auth/types";

describe("path jail / Zip Slip guards", () => {
  const root = path.resolve("/tmp/sofa-security-root");

  it("allows paths under root", () => {
    const ok = resolveUnderRoot(root, "public", "a.pdf");
    assert.ok(ok);
    assert.ok(ok!.startsWith(root));
  });

  it("rejects traversal outside root", () => {
    assert.equal(resolveUnderRoot(root, "..", "etc", "passwd"), null);
    assert.equal(resolveUnderRoot(root, "files", "..", "..", "etc"), null);
  });

  it("sanitizeBackupEntryName strips files/ and blocks ..", () => {
    assert.equal(sanitizeBackupEntryName("files/signatures/a.png"), "signatures/a.png");
    assert.equal(sanitizeBackupEntryName("files/../.env.local"), null);
    assert.equal(sanitizeBackupEntryName("../../etc/passwd"), null);
    assert.equal(sanitizeBackupEntryName("/etc/passwd"), null);
    assert.equal(sanitizeBackupEntryName("files/storage/course-notices/x.pdf"), "storage/course-notices/x.pdf");
  });

  it("maps MIME to safe extensions only", () => {
    assert.equal(extensionForMime("application/pdf"), ".pdf");
    assert.equal(extensionForMime("application/x-msdownload"), null);
    assert.equal(extensionForMime("text/html"), null);
  });
});

describe("timing-safe compare", () => {
  it("returns true for equal strings", () => {
    assert.equal(timingSafeEqualString("abc", "abc"), true);
  });

  it("returns false for unequal strings", () => {
    assert.equal(timingSafeEqualString("abc", "abd"), false);
    assert.equal(timingSafeEqualString("abc", "ab"), false);
  });
});

describe("login rate limit", () => {
  it("blocks after max failures", () => {
    __resetLoginRateLimitForTests();
    const key = "127.0.0.1|attacker";
    for (let i = 0; i < 10; i++) recordLoginFailure(key);
    const blocked = checkLoginRateLimit(key);
    assert.equal(blocked.allowed, false);
    assert.ok((blocked.retryAfterSec ?? 0) > 0);
    clearLoginFailures(key);
    assert.equal(checkLoginRateLimit(key).allowed, true);
  });
});

describe("instructor course authorization", () => {
  const admin: SessionUser = {
    userId: 1,
    username: "admin",
    name: "Admin",
    role: "admin",
    assignedCourseId: null,
  };
  const instructor: SessionUser = {
    userId: 2,
    username: "inst",
    name: "Inst",
    role: "instructor",
    assignedCourseId: 5,
  };

  it("admin can manage any course", () => {
    assert.equal(canManageResultsForCourse(admin, 99), true);
  });

  it("instructor only assigned course", () => {
    assert.equal(canManageResultsForCourse(instructor, 5), true);
    assert.equal(canManageResultsForCourse(instructor, 6), false);
  });

  it("instructor without assignment cannot manage", () => {
    const bare = { ...instructor, assignedCourseId: null };
    assert.equal(canManageResultsForCourse(bare, 5), false);
  });
});
