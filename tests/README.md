# RADAR Sanitary — Automated Test Suite

## Overview

Automated tests for the RADAR food-safety inspection system (`@reto/backend`, `@reto/frontend`, `@reto/db`, `@reto/shared`).

Latest verified run (2026-09-25), after dedicated `radar_test` isolation and multi-role UI journeys:

| Suite | Unique tests | Executions | Passed | Failed | Skipped | Flaky |
|-------|--------------|------------|--------|--------|---------|-------|
| API smoke (`API_URL=http://127.0.0.1:3010/api/v1`) | 121 | 121 | 121 | 0 | 0 | 0 |
| API full (`pnpm test:api:full` against `radar_test`) | 349 | 349 | 349 | 0 | 0 | 0 |
| E2E Chromium (`project` `chromium`) | 83 | 83 | 83 | 0 | 0 | 0 |
| E2E Pixel 5 (`project` `mobile-chrome`) | 78 | 78 | 78 | 0 | 0 | 0 |
| Playwright listed total | 83 unique | **161** | **161** | **0** | **0** | **0** |
| Playwright flake re-run | 83 unique | **161** | **161** | **0** | **0** | **0** |
| Combined API + one Playwright pass | 553 unique | **631** | **631** | **0** | **0** | **0** |

Playwright lists **161 executions** because 83 unique E2E titles run on Chromium and 78 of those also run on Pixel 5. Three long role-handoff specs are Chromium-only (`bpm-lifecycle`, `institutional-scheduling`, `reports-history`). Do not add Chromium + Pixel 5 + unique titles as if they were independent suites.

`pnpm test` (root) runs **only** `test:api:full`. Use `pnpm test:all` for smoke + API + E2E. Playwright and API suites now default to port **3010** and database **`radar_test`**. They do not mutate the shared compose database `midb2`.

---

## Data safety

The compose database `midb2` on host port 5433 is treated as **shared / not disposable**. Historical Prisma `P3005` and a read-only `_prisma_migrations` check (3 rows, no schema change applied) are the reason tests never drop, reset, or reseed it.

Mutating test setup is gated by `scripts/test-db-guard.mjs`:

- Allowlist: `radar_test` only
- Blocked: `midb2`, `postgres`, `template0`, `template1`
- `scripts/reset-test-state.mjs` disables 2FA **only** on the allowlisted database (verified `UPDATE 0` after the API suite; `radar_test` had 0 enabled 2FA rows)
- `scripts/ensure-test-db.mjs` (Playwright `globalSetup`) creates `radar_test` if missing, applies migrations to that database only, and seeds it only when empty
- Playwright `webServer` starts backend **3010** + frontend **5174** so a local `3000`/`5173`/`midb2` stack is left untouched
- E2E company users use `@e2e.radar.test` emails and `deactivateE2eUsers()` soft-deletes them in `afterEach`

Inspect `.env` locally before changing database targets. Do **not** point `TEST_PG_DB` at `midb2`.

---

## Prerequisites

1. Docker Desktop running
2. Node.js ≥ 20 and pnpm
3. PostgreSQL from `docker-pg/docker-compose.yml` (container `mi-postgres2`, host port **5433**). Shared data lives in `midb2`; tests use **`radar_test`**
4. Playwright Chromium: `pnpm exec playwright install chromium`
5. `pnpm test:db:ensure` once (also runs automatically as Playwright global setup)

The shared app (`pnpm dev` on 3000/5173) is **not** required for Playwright. Playwright starts its own servers.

```powershell
pnpm db:up
pnpm test:db:ensure
pnpm exec playwright install chromium
```

If Docker is not on PATH, start Docker Desktop first. The reset script **exits 1** when the target database is not allowlisted — it does not fail open onto `midb2`.

---

## Commands

| Command | What it runs |
|---------|----------------|
| `pnpm test` | API full suite only (resets 2FA on `radar_test`, then `tests/api/*.test.mjs`) |
| `pnpm test:db:ensure` | Create/migrate/seed `radar_test` only; never touches `midb2` |
| `pnpm test:api:smoke` | `scripts/api-smoke-tests.mjs` (121 checks, some accept multiple status codes). Defaults to `http://127.0.0.1:3010/api/v1` |
| `pnpm test:api:full` | Reset 2FA on `radar_test`, then node:test with `--test-concurrency=1` |
| `pnpm test:api:auth` … `test:api:workflows` | Single API module |
| `pnpm test:e2e` | Playwright Chromium + Pixel 5 (starts 3010/5174) |
| `pnpm test:e2e:chromium` | Chromium only |
| `pnpm test:e2e:mobile` | Pixel 5 viewport only |
| `pnpm test:e2e:journeys` | New multi-role UI journeys |
| `pnpm test:e2e:auth` / `:nav` / `:company` / `:pwa` | One original spec file, both projects |
| `pnpm test:e2e:headed` | Headed browsers |
| `pnpm test:all` | smoke **and** API full **and** Playwright (requires the 3010 test backend for API, or Playwright’s webServer for E2E) |
| `pnpm build:packages` | `@reto/db` then `@reto/shared` |
| `pnpm --filter @reto/backend build` | Backend TypeScript build |
| `pnpm --filter @reto/frontend build` | Frontend Vite production build |

List Playwright executions (not unique titles):

```powershell
pnpm exec playwright test --config=tests/playwright.config.ts --list
```

---

## Seed / reset

Seeded password: `Password123!`

| Role | Email |
|------|--------|
| ADMIN | `admin@salud.gob.do` |
| COORDINADOR | `coordinador@salud.gob.do` |
| TECNICO_EVALUADOR | `tecnico1@salud.gob.do` |
| TECNICO_EVALUADOR (2) | `tecnico2@salud.gob.do` |
| ADMIN_EMPRESA | `admin@lacteosdelnorte.do` |
| USUARIO_DELEGADO | `delegado@lacteosdelnorte.do` |

`scripts/reset-test-state.mjs` runs `UPDATE two_factor_auth SET enabled = false` **only** inside allowlisted `radar_test`. The full API suite uses `--test-concurrency=1` so a 2FA test cannot poison another file’s cached admin token.

2FA tests use an **isolated registered user**. Seeded accounts are never left with `enabled = true`. `loginAs()` throws if login returns `requiresTwoFactor` instead of caching a null token.

E2E journeys create unique `@e2e.radar.test` accounts and soft-delete them in teardown. Inactive users are excluded from `GET /users` and the pending validation list.

---

## Environment

```
API_URL=http://127.0.0.1:3010/api/v1
TEST_PASSWORD=Password123!
TEST_ADMIN=admin@salud.gob.do
TEST_COORDINATOR=coordinador@salud.gob.do
TEST_TECHNICIAN=tecnico1@salud.gob.do
TEST_COMPANY=admin@lacteosdelnorte.do
TEST_DELEGATE=delegado@lacteosdelnorte.do
TEST_PG_CONTAINER=mi-postgres2
TEST_PG_USER=miusuario
TEST_PG_DB=radar_test
BASE_URL=http://127.0.0.1:5174
E2E_API_PORT=3010
E2E_WEB_PORT=5174
```

Do not set `TEST_PG_DB=midb2`. Playwright global setup and the 2FA reset will refuse blocked names.

SMTP in `.env` is a dummy Gmail account for the shared 3000 stack. The test backend starts with `SMTP_HOST=''` so assignment mail is logged, not sent.

---

## Layout

```
tests/
├── README.md
├── playwright.config.ts
├── api/
│   ├── helpers.mjs
│   ├── 01-auth.test.mjs
│   ├── 02-users.test.mjs
│   ├── 03-roles-catalogs.test.mjs
│   ├── 04-institutions.test.mjs
│   ├── 05-bpm-requests.test.mjs
│   ├── 06-cases.test.mjs
│   ├── 07-evaluations.test.mjs
│   ├── 08-alerts-complaints-notifications.test.mjs
│   ├── 09-uploads.test.mjs
│   └── 10-workflows.test.mjs
└── e2e/
    ├── global-setup.ts
    ├── helpers.ts
    ├── auth.spec.ts
    ├── navigation.spec.ts
    ├── company.spec.ts
    ├── operational.spec.ts
    ├── pwa.spec.ts
    ├── registration.spec.ts
    ├── company-establishments.spec.ts
    ├── bpm-lifecycle.spec.ts
    ├── institutional-scheduling.spec.ts
    ├── lapch-alerts.spec.ts
    ├── complaints.spec.ts
    ├── reports-history.spec.ts
    └── notifications-dashboards.spec.ts

scripts/
├── api-smoke-tests.mjs
├── reset-test-state.mjs
├── test-db-guard.mjs
├── ensure-test-db.mjs
├── start-test-backend.mjs
└── start-test-frontend.mjs
```

Artifacts (`test-results/`, `playwright-report/`, backend/frontend log dumps) are gitignored. Traces, screenshots, and videos are retained **on failure only**.

---

## Feature-to-test matrix

SRS RF-01–RF-20 mapped to **UI journeys** vs API-only. API coverage is not claimed as UI coverage.

| RF | Actor | UI journey | Existing | Notes / gaps |
|----|-------|------------|----------|--------------|
| RF-01 | All roles | Sign-in, validation, session | `auth.spec.ts` | UI |
| RF-02 | Applicant + ADMIN | Sign-up, pending block, approve/reject | `registration.spec.ts` | Sign-up uploads the authorization letter and links it to the applicant. Pending and rejected logins show the mapped English messages |
| RF-03 | ADMIN_EMPRESA / delegate | Register establishment + legal representative; other companies cannot see it | `company-establishments.spec.ts` | Portal shows the saved name and role from `representantes` after reload |
| RF-04 | Coordinator / technician / company | Assignment notification isolation + dashboards | `notifications-dashboards.spec.ts`, `navigation.spec.ts` | UI |
| RF-05 | Company | Draft BPM, reopen, attach, submit | `bpm-lifecycle.spec.ts`, `company.spec.ts` | Attachment cards show the API `fileName` after reopen |
| RF-06 | Coordinator | Assign / reassign technician | `bpm-lifecycle.spec.ts`, `institutional-scheduling.spec.ts` | UI |
| RF-07 / RF-10 | Coordinator / technician | Schedule + calendar visibility | `institutional-scheduling.spec.ts` | Coordinator calendar can reschedule and cancel. `GET /evaluations/calendar` stays technician-only |
| RF-08 | Coordinator | LAPCH proceeds + does-not-proceed | `lapch-alerts.spec.ts` | UI; technician/company nav hidden |
| RF-09 | Coordinator | Complaint proceeds / no-proceed / referral | `complaints.spec.ts` | There is **no** unauthenticated public intake page. Generate-case requires a linked establishment (400 otherwise) |
| RF-11–RF-15 | Technician | Start field form, C/CP/NC/N/A, evidence, save, score, lock | `bpm-lifecycle.spec.ts` | Offline keeps started status, answers, and Save Draft, then syncs on reconnect. New evidence files still need a connection. Vite dev has no offline app shell |
| RF-16–RF-18 | Technician + coordinator | Submit report, request correction, save, resubmit, approve, close | `bpm-lifecycle.spec.ts` | `EN_CORRECCION` / `DEVUELTO` enables Resubmit Correction on the same report |
| RF-19 | Coordinator | Official file after close | `bpm-lifecycle.spec.ts` | Download is `200` `application/pdf` and begins with `%PDF-` |
| RF-20 | Coordinator / company | History search + company-scoped certificates | `reports-history.spec.ts` | UI |
| RNF-01 | — | Manifest, `sw.js` served, no SW controller in Vite dev | `pwa.spec.ts` | Production service-worker registration is **not** covered (SW only registers in `PROD`) |

### Authentication (RF-01)

| Behavior | Coverage |
|----------|----------|
| Login email / cédula, all five roles | API 01, E2E auth |
| Wrong password, unknown user, missing fields | API 01, E2E auth |
| Pending user → 403 | API 01, E2E registration (UI shows pending approval) |
| Refresh / logout | API 01, E2E auth (logout + reload) |
| Forgot password (no enumeration) | API 01, E2E auth |
| Reset with DB-issued token; invalid token | API 01 |
| Change password on isolated user | API 01 |
| 2FA enable + invalid OTP + valid TOTP, then cleanup | API 01 |
| Protected routes without token | API 01, smoke |

### Users, roles, catalogs (RF-02, RF-14, catalogs)

| Behavior | Coverage |
|----------|----------|
| List / get / register / status / delete / self PATCH | API 02 |
| Approve / reject through User validation UI | E2E registration |
| Role list | API 03 |
| Provinces, municipalities, health areas, foods, categories | API 03 |
| Risk frequency rules get/patch (ADMIN only) | API 03 |
| User validation UI (search, tabs, table) | E2E operational |
| Governance UI (risk matrix, food catalog) | E2E operational |

### Institutions (RF-03)

| Behavior | Coverage |
|----------|----------|
| CRUD-shaped list/get/history/evaluations, create, represent | API 04 |
| Company portal establishment dialog + empty submit | E2E operational, E2E company-establishments |
| Cross-company isolation of a new plant | E2E company-establishments |

### Dashboards (RF-04)

| Behavior | Coverage |
|----------|----------|
| Empresa / coordinador / tecnico role gates | API 08 |
| Command center metrics, lifecycle, primary action | E2E navigation |
| Assignment notification visible to technician, not company | E2E notifications-dashboards |

### BPM, cases, assignments, evaluations (RF-05–RF-11)

| Behavior | Coverage |
|----------|----------|
| BPM list/create/update/submit | API 05, E2E company (draft + empty), E2E bpm-lifecycle (draft → submit) |
| Cases list/create/priority/close/PDF | API 06, API 10, E2E bpm-lifecycle |
| Assign / reassign | API 06, API 10, E2E bpm-lifecycle, E2E institutional-scheduling |
| Evaluations list/calendar/create/reschedule/cancel | API 07, E2E institutional-scheduling (coordinator calendar) |
| Full BPM → assign → eval → answers → evidence → finish → report review/correct/resend/approve → close + PDF | API 10 **and** E2E `bpm-lifecycle.spec.ts` (separate contexts per role) |

### Field work, risk, evidence, reports (RF-12–RF-18)

| Behavior | Coverage |
|----------|----------|
| Templates, start, answers, finish | API 07, API 10, E2E bpm-lifecycle |
| Score vs C=1 / CP=0.5 / NC=0 / N/A ignored | API 07, API 10, E2E bpm-lifecycle |
| Evidence create/delete | API 07, API 10, E2E bpm-lifecycle (upload) |
| Report submit/review/correct/resend | API 07, API 10, E2E bpm-lifecycle |
| Field assessment empty or assigned hero | E2E operational |
| Reports & closure tab | E2E operational |

### Alerts, complaints, notifications, history (RF-08, RF-09, RF-20)

| Behavior | Coverage |
|----------|----------|
| LAPCH CRUD + generate-case + close | API 08, API 10, E2E lapch-alerts (proceeds + no-proceed) |
| Public complaint + generate-case | API 08, API 10; E2E complaints is **coordinator intake**, not a public page |
| Notifications list/read isolation | API 08, E2E navigation (bell + dialog), E2E notifications-dashboards |
| History search | API 08, E2E operational (360° tab), E2E reports-history |
| Intake complaints/LAPCH form | E2E operational, E2E lapch-alerts, E2E complaints |

### Attachments

| Behavior | Coverage |
|----------|----------|
| PNG upload/get/delete, isolation, 25MB+1 → 400 | API 09 |
| Missing file, missing category, 401 | API 08, API 09 |
| BPM request attachment | API 09, E2E bpm-lifecycle (UI shows `fileName`) |

### Frontend routes / a11y / responsive / PWA

| Screen | Coverage |
|--------|----------|
| Auth (sign-in, sign-up, recovery, 2FA prompt not on seeded users) | E2E auth |
| Command center, Users, Governance, Cases, Reports, Operations, Calendar, Company, Field | E2E navigation + operational |
| Role-hidden nav items | E2E auth, navigation, operational, lapch, complaints, reports-history |
| Hamburger + off-canvas sidebar | E2E navigation (desktop narrow + Pixel 5) |
| Keyboard focus on sign-in | E2E auth |
| Offline Mode / Connected | E2E navigation, pwa |
| Manifest + `sw.js` served; **no** SW control in Vite dev | E2E pwa |

---

## API module counts (node:test)

| File | Tests |
|------|-------|
| 01-auth | 43 |
| 02-users | 27 |
| 03-roles-catalogs | 25 |
| 04-institutions | 33 |
| 05-bpm-requests | 20 |
| 06-cases | 37 |
| 07-evaluations | 68 |
| 08-alerts-complaints-notifications | 72 |
| 09-uploads | 12 |
| 10-workflows | 12 |
| **Total** | **349** |

E2E unique titles: auth 24, navigation 21, company 6, operational 13, pwa 5, registration 3, company-establishments 1, bpm-lifecycle 1, institutional-scheduling 1, lapch 2, complaints 2, reports-history 3, notifications 1 = **83**. Chromium runs all 83; Pixel 5 runs 78 (omits bpm-lifecycle, institutional-scheduling, reports-history). Listed executions: **161**.

---

## Discovered application defects

### DEFECT-001 — 500 on `POST /auth/2fa/enable` with JSON `null` body and no auth

Fixed. Malformed JSON (`null`) is `400 VALIDATION_ERROR` with message `Request body is not valid JSON`. A request with no body still returns `401`.

### DEFECT-002 — Multer `LIMIT_FILE_SIZE` used to return 500

Oversized uploads (`25MB + 1`) escaped as `INTERNAL_ERROR`. `errorHandler` now maps `multer.MulterError` to **400 VALIDATION_ERROR**. Covered by API 09.

### DEFECT-003 — Header controls lacked accessible names

Notification and profile buttons used `title` plus inner text/emoji, so the accessible name was not “Notifications” / “Account menu”. `aria-label` was added (plus hamburger `Open navigation`). Visual behavior unchanged.

### DEFECT-004 — Official case PDF is a 302 to a `.txt` stub

Fixed. Close writes a PDF attachment. The download endpoint returns that file with `Content-Type: application/pdf`.

### DEFECT-005 — Pending / rejected login copy is unmapped

Fixed in the UI. The API messages stay English. The sign-in screen maps `pending` and `rejected`.

### DEFECT-006 — Company portal ignores persisted representatives

Fixed. The portal reads `representantes` and shows the name plus the persisted role (`LEGAL`, `CALIDAD`, `CONTACTO`).

### DEFECT-007 — Attachment cards use the wrong filename field

Fixed. Cards prefer `fileName`.

### DEFECT-008 — Intake list items lack React keys

`IntakePanel` complaint/alert rows produce React key warnings in the console. Tests still locate rows with `.ops-list > div`.

### DEFECT-009 — Offline rehydrate disables a started field form

Fixed for the supported save path. Started status and answers survive an offline transition and a client-side remount, and Save Draft stays enabled. Evidence file upload still requires a connection. A full document reload while offline is not available in the Vite dev server because the service worker registers only in production.

### DEFECT-010 — Resubmit Correction after SOLICITAR_CORRECCION

Fixed. Resubmit is enabled when the report status is `EN_CORRECCION` or `DEVUELTO`.

### DEFECT-011 — Sign-up has no authorization-letter file input

Fixed. Public `POST /users/register/authorization-letter` stores a `CARTA_AUTORIZACION` file, and registration links `cartaAutorizacionFileId`.

### DEFECT-012 — No public unauthenticated complaint page

SRS RF-09 public intake. Complaints are recorded in the coordinator Operations workbench. There is no unauthenticated public form.

### DEFECT-013 — Calendar has no reschedule / cancel controls

Fixed for coordinators on the calendar event. Technicians do not see the actions. Empty date shows a validation message; cancel asks for confirmation. `GET /evaluations/calendar` remains `TECNICO_EVALUADOR` only (DEFECT-015 is the intended role policy, not a defect to relax).

### DEFECT-014 — Soft-deleted applicants remain in the pending list

Fixed. `GET /users` returns only `isActive: true`, and the validation table applies the same filter.

### DEFECT-015 — Admin calendar GET is 403

`GET /evaluations/calendar` as ADMIN returns 403 in some operational runs. The Calendar screen still loads a heading; the 403 is logged.

---

## Remaining limitations

1. **SMTP** — Shared 3000 stack uses dummy Gmail (~10s timeout). The dedicated 3010 test backend starts with `SMTP_HOST=''` so assignment mail is logged, not sent. No inbox assertion.
2. **Service worker in production** — Registered only when `import.meta.env.PROD`. Dev E2E asserts the file is served and that no controller takes over. Production PWA install/offline cache is **not** covered.
3. **Firefox / WebKit / Edge / real devices** — Not added as Playwright projects. Pixel 5 is Chromium device emulation, not a physical phone. SRS browser compatibility was not executed.
4. **Concurrency / load** — API suite is serial (`--test-concurrency=1`) by design after the 2FA cache leak.
5. **GPS / offline evidence** — LiveField GPS is not driven in E2E. Answer drafts sync after reconnect. Uploading a new evidence file while offline is not queued.
6. **Smoke suite** still allows some multi-status expectations (`200/404`, etc.). The node:test suite asserts exact codes for those cases. Smoke can close seed alert id `1` on `radar_test` (disposable).
7. **Seeded data on radar_test** — Isolated `@e2e.radar.test` users are soft-deleted. Do not reseed `midb2` from these scripts.
8. **No disable-2FA HTTP API** — Cleanup uses SQL (`disableAllTwoFactor` / reset script) **only** on allowlisted `radar_test`.
9. **Public complaint page** — SRS RF-09 public intake is still the coordinator Operations workbench. No unauthenticated public form was added.
10. **BPM draft PATCH** — Company Portal reopens a draft for attach/submit only; `bpmRequestsService.update` is not called from the UI.
11. **Representative `cargo`** — the add-rep form collects Position but does not send it; there is no edit/delete-rep UI.
12. **Calendar “today”** — `TechnicianCalendar` hard-codes `2026-09-21` as today. Journeys schedule ~2 hours ahead and match event pills in the September month view; they do not click Today.
13. **LAPCH close-without-case** — `POST /lapch-alerts/:id/close` exists; Intake only uses Proceeds / Does Not Proceed (no close button).
14. **ADMIN_EMPRESA vs USUARIO_DELEGADO** — Company Portal shows the same buttons; API may 403 a delegate on create-institution / add-rep. Isolation tests use a new ADMIN_EMPRESA, not the seeded delegate, for the unique plant.

---

## CI / headless

Playwright uses headless Chromium by default, `retries: 1` only when `CI` is set, one worker, traces/screenshots/videos on failure. HTML report writes to `playwright-report/` (gitignored).
