# RADAR Sanitary — Automated Test Suite

## Overview

Automated tests for the RADAR food-safety inspection system (`@reto/backend`, `@reto/frontend`, `@reto/db`, `@reto/shared`).

Latest verified run (2026-09-25), after the 2FA isolation, Playwright locator, and company-portal race fixes:

| Suite | Unique tests | Executions | Passed | Failed | Skipped | Flaky |
|-------|--------------|------------|--------|--------|---------|-------|
| API smoke (`pnpm test:api:smoke`) | 121 | 121 | 121 | 0 | 0 | 0 |
| API full (`pnpm test:api:full`, node:test) | 349 | 349 | 349 | 0 | 0 | 0 |
| E2E Chromium (`tests/playwright.config.ts` project `chromium`) | 69 | 69 | 69 | 0 | 0 | 0 |
| E2E Pixel 5 (`project` `mobile-chrome`) | 69 | 69 | 69 | 0 | 0 | 0 |
| **Intended full suite (`pnpm test:all`)** | 539 unique | **608** | **608** | **0** | **0** | **0** |

Playwright lists **138 executions** because each of the 69 unique E2E tests runs in both projects. Do not add Chromium + Pixel 5 + unique titles as if they were independent suites.

`pnpm test` (root) runs **only** `test:api:full`. Use `pnpm test:all` for smoke + API + E2E.

---

## Prerequisites

1. Docker Desktop running
2. Node.js ≥ 20 and pnpm
3. PostgreSQL from `docker-pg/docker-compose.yml` (container `mi-postgres2`, database `midb2`, host port **5433**)
4. Backend on `http://localhost:3000`
5. Frontend on `http://localhost:5173` (E2E only)
6. Playwright Chromium: `pnpm exec playwright install chromium`

Start the stack from `dev-web-reto/`:

```powershell
pnpm db:up
pnpm db:migrate
pnpm seed
pnpm dev
```

If Docker is not on PATH, start Docker Desktop first. The reset script **exits 1** when `docker exec mi-postgres2` cannot disable 2FA — it does not fail open.

Install browsers once:

```powershell
pnpm exec playwright install chromium
```

---

## Commands

| Command | What it runs |
|---------|----------------|
| `pnpm test` | API full suite only (resets 2FA, then `tests/api/*.test.mjs`) |
| `pnpm test:api:smoke` | `scripts/api-smoke-tests.mjs` (121 checks, some accept multiple status codes) |
| `pnpm test:api:full` | Reset 2FA, then node:test with `--test-concurrency=1` |
| `pnpm test:api:auth` … `test:api:workflows` | Single API module |
| `pnpm test:e2e` | Playwright Chromium + Pixel 5 |
| `pnpm test:e2e:chromium` | Chromium only |
| `pnpm test:e2e:mobile` | Pixel 5 viewport only |
| `pnpm test:e2e:auth` / `:nav` / `:company` / `:pwa` / `:ops` | One spec file, both projects |
| `pnpm test:e2e:headed` | Headed browsers |
| `pnpm test:all` | smoke **and** API full **and** Playwright (the intended complete suite) |
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
| ADMIN_EMPRESA | `admin@lacteosdelnorte.do` |
| USUARIO_DELEGADO | `delegado@lacteosdelnorte.do` |

`scripts/reset-test-state.mjs` runs `UPDATE two_factor_auth SET enabled = false` inside `mi-postgres2`. The full API suite uses `--test-concurrency=1` so a 2FA test cannot poison another file’s cached admin token.

2FA tests use an **isolated registered user**. Seeded accounts are never left with `enabled = true`. `loginAs()` throws if login returns `requiresTwoFactor` instead of caching a null token.

---

## Environment

```
API_URL=http://localhost:3000/api/v1
TEST_PASSWORD=Password123!
TEST_ADMIN=admin@salud.gob.do
TEST_COORDINATOR=coordinador@salud.gob.do
TEST_TECHNICIAN=tecnico1@salud.gob.do
TEST_COMPANY=admin@lacteosdelnorte.do
TEST_DELEGATE=delegado@lacteosdelnorte.do
TEST_PG_CONTAINER=mi-postgres2
TEST_PG_USER=miusuario
TEST_PG_DB=midb2
BASE_URL=http://localhost:5173
```

SMTP in `.env` is a dummy Gmail account. Assignment emails wait on nodemailer’s ~10s connection timeout. The BPM closure API workflow therefore takes ~30s; that is SMTP, not an arbitrary test sleep.

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
    ├── helpers.ts
    ├── auth.spec.ts
    ├── navigation.spec.ts
    ├── company.spec.ts
    ├── operational.spec.ts
    └── pwa.spec.ts

scripts/
├── api-smoke-tests.mjs
└── reset-test-state.mjs
```

Artifacts (`test-results/`, `playwright-report/`, backend/frontend log dumps) are gitignored. Traces, screenshots, and videos are retained **on failure only**.

---

## Feature-to-test matrix

### Authentication (RF-01)

| Behavior | Coverage |
|----------|----------|
| Login email / cédula, all five roles | API 01, E2E auth |
| Wrong password, unknown user, missing fields | API 01, E2E auth |
| Pending user → 403 | API 01 |
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
| Role list | API 03 |
| Provinces, municipalities, health areas, foods, categories | API 03 |
| Risk frequency rules get/patch (ADMIN only) | API 03 |
| User validation UI (search, tabs, table) | E2E operational |
| Governance UI (risk matrix, food catalog) | E2E operational |

### Institutions (RF-03)

| Behavior | Coverage |
|----------|----------|
| CRUD-shaped list/get/history/evaluations, create, represent | API 04 |
| Company portal establishment dialog + empty submit | E2E operational |

### Dashboards (RF-04)

| Behavior | Coverage |
|----------|----------|
| Empresa / coordinador / tecnico role gates | API 08 |
| Command center metrics, lifecycle, primary action | E2E navigation |

### BPM, cases, assignments, evaluations (RF-05–RF-11)

| Behavior | Coverage |
|----------|----------|
| BPM list/create/update/submit | API 05, E2E company (draft + empty) |
| Cases list/create/priority/close/PDF stub | API 06, E2E operational |
| Assign / reassign | API 06, API 10 |
| Evaluations list/calendar/create/reschedule/cancel | API 07, E2E calendar |
| Full BPM → assign → eval → answers → evidence → finish → report review/correct/resend/approve → close + 302 PDF | API 10 |

### Field work, risk, evidence, reports (RF-12–RF-18)

| Behavior | Coverage |
|----------|----------|
| Templates, start, answers, finish | API 07, API 10 |
| Score | API 07, API 10 |
| Evidence create/delete | API 07, API 10 |
| Report submit/review/correct/resend | API 07, API 10 |
| Field assessment empty or assigned hero | E2E operational |
| Reports & closure tab | E2E operational |

### Alerts, complaints, notifications, history (RF-08, RF-09, RF-20)

| Behavior | Coverage |
|----------|----------|
| LAPCH CRUD + generate-case + close | API 08, API 10 |
| Public complaint + generate-case | API 08, API 10 |
| Notifications list/read isolation | API 08, E2E navigation (bell + dialog) |
| History search | API 08, E2E operational (360° tab) |
| Intake complaints/LAPCH form | E2E operational |

### Attachments

| Behavior | Coverage |
|----------|----------|
| PNG upload/get/delete, isolation, 25MB+1 → 400 | API 09 |
| Missing file, missing category, 401 | API 08, API 09 |
| BPM request attachment | API 09 |

### Frontend routes / a11y / responsive / PWA

| Screen | Coverage |
|--------|----------|
| Auth (sign-in, sign-up, recovery, 2FA prompt not on seeded users) | E2E auth |
| Command center, Users, Governance, Cases, Reports, Operations, Calendar, Company, Field | E2E navigation + operational |
| Role-hidden nav items | E2E auth, navigation, operational |
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

E2E unique titles: auth 24, navigation 21, company 6, operational 13, pwa 5 = **69** × 2 projects = **138**.

---

## Discovered application defects

### DEFECT-001 — 500 on `POST /auth/2fa/enable` with JSON `null` body and no auth

Unusual client payload. Auth should 401 first; the handler can 500. Low severity. **Not patched** (preserve production behavior unless the defect is in the test path).

### DEFECT-002 — Multer `LIMIT_FILE_SIZE` used to return 500

Oversized uploads (`25MB + 1`) escaped as `INTERNAL_ERROR`. `errorHandler` now maps `multer.MulterError` to **400 VALIDATION_ERROR**. Covered by API 09.

### DEFECT-003 — Header controls lacked accessible names

Notification and profile buttons used `title` plus inner text/emoji, so the accessible name was not “Notifications” / “Account menu”. `aria-label` was added (plus hamburger `Open navigation`). Visual behavior unchanged.

### DEFECT-004 — Official case PDF is a 302 to a `.txt` stub

`GET /cases/:id/close/pdf` after a completed workflow redirects to a text placeholder, not a generated PDF. Tests assert the 302. Real PDF rendering is not implemented.

---

## Remaining limitations

1. **SMTP** — Dummy Gmail; assignment mail blocks ~10s each. No inbox assertion.
2. **Service worker in production** — Registered only when `import.meta.env.PROD`. Dev E2E asserts the file is served and that no controller takes over.
3. **Real devices / WebKit / Firefox** — Pixel 5 is Playwright device emulation on Chromium, not a physical phone.
4. **Concurrency / load** — API suite is serial (`--test-concurrency=1`) by design after the 2FA cache leak.
5. **GPS / IndexedDB field sync** — LiveField GPS and offline queue are not driven end-to-end in Playwright.
6. **Smoke suite** still allows some multi-status expectations (`200/404`, etc.). The node:test suite asserts exact codes for those cases.
7. **Seeded data mutation** — Workflows create isolated BPM/cases; some smoke mutations (e.g. close alert) hit seed ids. Re-seed if the database is dirty: `pnpm seed`.
8. **No disable-2FA HTTP API** — Cleanup uses SQL (`disableAllTwoFactor` / reset script).

---

## CI / headless

Playwright uses headless Chromium by default, `retries: 1` only when `CI` is set, one worker, traces/screenshots/videos on failure. HTML report writes to `playwright-report/` (gitignored).
