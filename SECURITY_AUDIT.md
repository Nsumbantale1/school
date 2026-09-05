# Security Audit Report — School of Field Artillery (SOFA2)

**Audit date:** 2026-09-02  
**Scope:** Full application (`school/` Next.js app, Neon PostgreSQL + Drizzle, file storage, API routes, auth, backup/restore)  
**Auditor role:** Senior application security engineer (code review + automated tests + dependency scan)

---

## Executive summary

This application is a **custom Next.js server** with **Neon PostgreSQL** (not Supabase). There is **no Row Level Security (RLS)** at the database layer; **all authorization must be enforced in application code** (server actions, API routes, middleware).

The audit identified **several critical and high-severity issues**, most tied to **weak secrets**, **backup Zip Slip / secret leakage**, **broken instructor scoping**, and **unauthenticated static file access** for course notice attachments.

**Fixes were implemented in code** for the highest-risk items (see *Fixed vulnerabilities*). The system is **not production-ready** until operators complete the **Production security checklist** (rotate secrets/passwords, HTTPS, monitoring, dependency upgrades).

**Automated tests:** `npm run test:security` — **12/12 passing** (path jail, session HMAC, rate limit, course authorization).

---

## Architecture notes (what was checked)

| Layer | Technology | Security implication |
|--------|------------|----------------------|
| Frontend | Next.js 16 App Router | UI role checks are **not** security controls |
| Auth | HMAC-signed HTTP-only session cookie | Edge middleware now verifies signature |
| Database | Neon + Drizzle ORM | Parameterized queries; **no RLS** |
| File storage | `public/` (signatures, photos) + `storage/` (private notices) | Public dir is world-readable if URL known |
| Backups | ZIP via `lib/utils/backup-core.ts` | Previously included `.env` and allowed Zip Slip |

---

## Critical vulnerabilities

### C-1: Default / weak `SESSION_SECRET` in local environment
- **What was checked:** Repository `.env` / `.env.local` patterns, `lib/auth/session.ts` startup validation.
- **How tested:** Code review; production guard rejects known weak secrets and secrets &lt; 32 chars when `NODE_ENV=production`.
- **Risk:** Forged session cookies → full account takeover.
- **Status:** **Partially fixed** — runtime rejects weak secrets in production; **operator must rotate** local secret (see checklist). **Do not commit** `.env` files (`.gitignore` covers `.env*`).

### C-2: Default seed passwords (`admin123`, `inst123`, `view123`)
- **What was checked:** `lib/db/seed.ts`, login flow.
- **How tested:** Code review; seed now **throws in production** and warns on weak dev passwords.
- **Risk:** Trivial admin login on any seeded/deployed instance.
- **Status:** **Mitigated in code** — change all passwords via `npm run change-password` before any shared use.

### C-3: Backup restore Zip Slip + arbitrary file write (including `.env.local`)
- **What was checked:** `restoreBackup`, `parseBackupZip`, `sanitizeBackupEntryName`, `resolveUnderRoot`.
- **How tested:** Unit tests in `tests/security.test.ts`; manual trace of malicious ZIP entries (`../../etc/passwd`, `/etc/passwd`, `files/../.env.local`).
- **Risk:** Admin restoring a malicious backup could overwrite secrets or escape `public/`.
- **Status:** **Fixed** — path sanitization, jail under `public/` or `storage/`, env snapshots stripped and never restored.

### C-4: Backup archives embedded `.env.local` (database credentials)
- **What was checked:** `createBackupBundle`, download API.
- **How tested:** Code review of zip contents.
- **Risk:** Backup ZIP theft = full DB credential exposure.
- **Status:** **Fixed** — env files no longer included in backups; restore UI option removed.

---

## High vulnerabilities

### H-1: Middleware only checked cookie presence (not HMAC validity)
- **Checked:** `middleware.ts` vs `lib/auth/session.ts`.
- **Tested:** Session tampering tests in `tests/session.test.ts`.
- **Risk:** Attacker could present malformed cookie and reach some routes before server-side checks.
- **Status:** **Fixed** — middleware calls `verifySessionTokenRaw` and clears invalid cookies.

### H-2: Login session omitted `assignedCourseId`
- **Checked:** `app/login/actions.ts`, instructor result/notice guards.
- **Tested:** Authorization unit tests; instructor without assignment denied.
- **Risk:** Instructors treated as unscoped → cross-course writes.
- **Status:** **Fixed** — `assignedCourseId` stored in session at login.

### H-3: Instructors could manage course notices/exercises for any course
- **Checked:** `course-notices/actions.ts`, course notice pages.
- **Tested:** `assertCanAccessCourse` wired to server actions and UI `canManage`.
- **Risk:** Cross-course notice/exercise creation/deletion.
- **Status:** **Fixed**.

### H-4: Official SOFA workbook import allowed for instructors (cross-course data import)
- **Checked:** `importOfficialSofaWorkbook` in `results/import/actions.ts`.
- **Tested:** Server action returns unauthorized for non-admin; UI hides import card for instructors.
- **Risk:** Instructor imports workbook for another course → mass student/result overwrite.
- **Status:** **Fixed** — **admin-only**.

### H-5: Course notice attachments served from `public/` without auth
- **Checked:** Upload path, direct `<a href="/course-notices/...">` links.
- **Tested:** New authenticated route `GET /api/course-notices/notices/[id]/attachment`.
- **Risk:** Anyone with URL could download attachments (no login).
- **Status:** **Fixed** — uploads go to `storage/course-notices/`; downloads require session via API.

### H-6: No login rate limiting
- **Checked:** `app/login/actions.ts`.
- **Tested:** `tests/security.test.ts` (10 failures / 15 min window).
- **Risk:** Online password guessing.
- **Status:** **Fixed** (in-memory per process). **Remaining:** use Redis/shared store for multi-instance production.

### H-7: Non-constant-time password/HMAC comparison
- **Checked:** `lib/auth/session.ts`.
- **Tested:** `timingSafeEqualString` unit tests.
- **Status:** **Fixed**.

### H-8: Dependency vulnerabilities (`xlsx`, transitive `sharp`/etc.)
- **Checked:** `npm audit --omit=dev` (25 issues reported: 1 critical, 19 high among deps).
- **Risk:** Prototype pollution / ReDoS in `xlsx` during import; image processing CVEs in `sharp`.
- **Status:** **Open** — see *Remaining risks*.

---

## Medium vulnerabilities

### M-1: No database-level RLS (Neon / Drizzle)
- **Checked:** All tables via Drizzle schema; no Postgres policies.
- **Risk:** Application bug = direct data exposure; compromised `DATABASE_URL` = full DB access.
- **Status:** **Accepted architecture** — enforce in app layer; consider DB roles + RLS for defense in depth.

### M-2: Viewer role can read all students/results (by design?)
- **Checked:** Dashboard pages use `getSessionUser` without row-level filters for viewers.
- **Risk:** Any viewer account sees institution-wide records (may be intended).
- **Status:** **Documented** — confirm business requirement; restrict if viewers should be course-scoped.

### M-3: Student photos & signatures remain under `public/`
- **Checked:** `public/student-photos`, `public/signatures`.
- **Risk:** URLs guessable/enumerable without app login if server serves static files.
- **Status:** **Open** — move to authenticated API routes (same pattern as notices).

### M-4: In-memory login rate limit not shared across instances
- **Status:** **Open** for horizontal scaling.

### M-5: CSP allows `'unsafe-inline'` and `'unsafe-eval'` (Next.js default tradeoff)
- **Checked:** `next.config.ts` security headers.
- **Status:** **Partial hardening** — tighten when compatible with Next.js bundling.

### M-6: No MFA / password reset / account lockout beyond rate limit
- **Checked:** Auth flows — login only.
- **Status:** **Open** — add MFA for admin if exposed to internet.

---

## Low vulnerabilities

### L-1: Session fixation not explicitly rotated on login
- **Checked:** New token issued on successful login (new cookie).
- **Status:** **Acceptable** — cookie replaced on login.

### L-2: `SESSION_MAX_AGE` 24h with no server-side revocation list
- **Status:** **Open** — logout clears cookie; stolen token valid until expiry.

### L-3: Audit logs / login logs readable only by admin (good) but no export retention policy
- **Status:** Operational hardening.

### L-4: Assistant (`/api/assistant`) accepts Ollama URL in env — SSRF risk if misconfigured
- **Status:** Low if `OLLAMA_URL` is localhost-only (current CSP `connect-src` allows local Ollama).

---

## Fixed vulnerabilities (summary)

| ID | Issue | Fix location |
|----|--------|--------------|
| C-3, C-4 | Zip Slip + env in backups | `lib/utils/backup-core.ts`, `lib/utils/security-path.ts` |
| H-1 | Weak middleware auth | `middleware.ts`, `lib/auth/session.ts` |
| H-2 | Missing `assignedCourseId` in session | `app/login/actions.ts` |
| H-3 | Course notice IDOR for instructors | `course-notices/actions.ts`, pages |
| H-4 | Instructor SOFA import | `results/import/actions.ts`, import UI |
| H-5 | Public notice attachments | `storage/course-notices`, attachment API route |
| H-6 | Login brute force | `lib/utils/login-rate-limit.ts`, login action |
| H-7 | Timing-safe compare | `lib/auth/session.ts`, `security-path.ts` |
| — | Security headers | `next.config.ts` |
| — | Seed passwords in production | `lib/db/seed.ts` |

---

## Remaining risks

1. **Rotate `SESSION_SECRET`** to a random ≥32-character value in production (never use the default).
2. **Change all user passwords** from seed defaults; disable/delete unused accounts.
3. **Rotate Neon database credentials** if `.env` was ever shared or backed up in old ZIPs.
4. **Upgrade/replace `xlsx`** — no patched version on npm; consider isolated import worker, file size limits, and trusted-source-only uploads (already admin-gated for official import).
5. **Move student photos/signatures** off `public/` to authenticated download routes.
6. **Shared rate limiting** (Redis) behind load balancer.
7. **HTTPS only** in production (`secure` cookie flag depends on `NODE_ENV=production`).
8. **Regular `npm audit`** and Next.js patch upgrades.
9. **Confirm viewer data scope** with stakeholders.

---

## Security tests performed

| Test | Command / method | Result |
|------|------------------|--------|
| Path traversal / Zip Slip sanitization | `npm run test:security` | Pass |
| HMAC session create/verify/tamper | `npm run test:security` | Pass |
| Login rate limit | `npm run test:security` | Pass |
| Instructor course authorization | `npm run test:security` | Pass |
| Production build | `npm run build` | Run after duplicate-import fix |
| Dependency scan | `npm audit --omit=dev` | 25 vulnerabilities (see H-8) |
| Manual authz review | All API routes + server actions | Documented above |
| Secret grep | `.env*` gitignored; no service role in frontend | No Supabase service keys (N/A) |

**Run tests:** `cd school && npm run test:security`

---

## Production security checklist

- [ ] Set `NODE_ENV=production` on host (Vercel/VPS)
- [ ] Generate new `SESSION_SECRET` (≥32 random bytes, store in host secrets manager)
- [ ] Rotate Neon `DATABASE_URL` password; update `.env.local` on server only
- [ ] Change **admin** password: `npm run change-password`
- [ ] Remove or disable default seed users on production DB
- [ ] Enforce **HTTPS** (TLS certificate, HSTS at reverse proxy)
- [ ] Restrict admin UI to **VPN or IP allowlist** if possible
- [ ] Enable **Neon** IP allowlisting / connection pooling limits
- [ ] Store backups encrypted; treat old ZIPs as **credential-bearing** if created before this fix
- [ ] Schedule `npm audit` and dependency updates
- [ ] Centralize logs (login failures, backup restore, imports)
- [ ] Add Redis-backed rate limiting for multi-instance deploys
- [ ] Review viewer role scope with command staff
- [ ] Optional: MFA for admin accounts
- [ ] Optional: Postgres RLS for defense in depth

---

## User-to-user isolation verdict

| Scenario | Result after fixes |
|----------|-------------------|
| User A modifies User B's student/result via server actions | **Blocked** — admin-only or course-scoped instructor checks |
| User A downloads User B's notice attachment by URL guessing | **Blocked** — requires authenticated API |
| User A restores malicious backup | **Still admin-only**; Zip Slip **blocked** |
| User A forges session cookie | **Blocked** — HMAC verification at middleware and server |
| User A (viewer) reads all institution data | **Allowed by current role model** — confirm if intended |
| User A (instructor) writes another course's notices/results | **Blocked** when `assignedCourseId` set |

---

## Supabase note

This project **does not use Supabase**. Database security is **application-enforced** on Neon PostgreSQL. RLS policies are **not applicable** unless you migrate to Supabase or add Postgres RLS manually.

---

*Report generated as part of security remediation work. Re-audit after major feature changes or before public internet exposure.*
