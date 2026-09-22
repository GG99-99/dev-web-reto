# Manual Test Plan - RADAR EBR/BPM

This document is a manual QA suite for the implemented application, based on:

- `documentos/SRS Solucion de Evaluacion Basada en Riesgo.md`
- `documentos/API_CONTRACTS.md`
- Backend routers, services, seeders, and frontend role navigation

The suite is intentionally workflow-oriented. Run the happy path first, then the permission and validation cases. Record the actual result, evidence, browser/device, user, and timestamp for every failed case.

## 1. Test Environment

### 1.1 Start-up

From `dev-web-reto`:

```powershell
pnpm install
pnpm db:up
pnpm db:migrate
pnpm seed
pnpm dev
```

Open:

- Frontend: `http://localhost:5173`
- API base: `http://localhost:3000/api/v1`

The smoke suite can be run after the manual smoke checks:

```powershell
pnpm test:api
```

### 1.2 Seeded Accounts

All seeded accounts use `Password123!` unless the database was changed after seeding.

| Account | Role | Expected status |
|---|---|---|
| `admin@salud.gob.do` | ADMIN | APROBADO |
| `coordinador@salud.gob.do` | COORDINADOR | APROBADO |
| `tecnico1@salud.gob.do` | TECNICO_EVALUADOR | APROBADO |
| `tecnico2@salud.gob.do` | TECNICO_EVALUADOR | APROBADO |
| `admin@lacteosdelnorte.do` | ADMIN_EMPRESA | APROBADO |
| `delegado@lacteosdelnorte.do` | USUARIO_DELEGADO | APROBADO |
| `admin@panaderiaelsol.do` | ADMIN_EMPRESA | PENDIENTE_VALIDACION |

The login identifier can be the email or the corresponding seeded cédula. The pending account must not be allowed to log in.

### 1.3 Test Data Rules

Use unique values for every new record unless a duplicate/conflict case explicitly requires reuse:

- Email: `qa+<timestamp>@example.test`
- Cédula: a valid-format test value not already in the database
- RNC: a unique valid-format test value
- Alert number: `QA-<timestamp>`
- Institution name: `QA Institution <timestamp>`

Keep at least one case/evaluation in each useful state: draft, pending assignment, assigned, in progress, finished, submitted, returned, approved, cancelled, and closed.

## 2. Execution Conventions

For every protected endpoint, repeat the check with:

- No `Authorization` header: expect `401`.
- A malformed or expired token: expect `401`.
- A valid token for a role outside the endpoint contract: expect `403`.
- A valid token for the allowed role: expect success.

For every resource endpoint, repeat the check with a nonexistent id: expect `404`.
For every create/update endpoint, repeat with missing required fields, invalid enum values, invalid dates, oversized values, and wrong data types: expect `400` with the standard error envelope.

Verify successful responses contain `valid: true` and the expected `data`. Verify errors contain `valid: false`, a stable error code, and do not expose passwords, hashes, tokens, stack traces, or database details.

## 3. Role and Navigation Smoke Matrix

| Case | Role | Steps | Expected result |
|---|---|---|---|
| AUTH-01 | All approved roles | Log in with each seeded approved account. | Login succeeds and the displayed name/role match the account. |
| AUTH-02 | Pending ADMIN_EMPRESA | Log in with `admin@panaderiaelsol.do`. | Login is rejected with pending-validation feedback; no session is created. |
| AUTH-03 | All roles | Inspect the navigation after login. | Each role sees only its permitted sections; hidden UI is not treated as authorization. |
| AUTH-04 | All roles | Open a hidden route or call its API directly. | Backend denies unauthorized operations with `403`. |
| AUTH-05 | All roles | Refresh the browser and close/reopen the tab. | Session behavior is consistent with the configured token/refresh flow; no unrelated role is displayed. |
| AUTH-06 | All roles | Log out, then revisit a protected view and call a protected API. | Session is removed and protected operations require login again. |

Expected main navigation:

- ADMIN: overview, calendar, company, users, cases, reports, operations, governance.
- COORDINADOR: overview, calendar, company, cases, reports, operations.
- TECNICO_EVALUADOR: overview, calendar, reports, field.
- ADMIN_EMPRESA: overview, company, operations.
- USUARIO_DELEGADO: overview, company, operations.

## 4. Authentication and Account Management - RF-01/RF-02

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| AUTH-07 | Login by email | Use an approved email and `Password123!`. | Access and refresh tokens are returned; user and role are returned. |
| AUTH-08 | Login by cédula | Use an approved seeded cédula and password. | Login succeeds exactly as with email. |
| AUTH-09 | Wrong password | Use a valid user and wrong password. | `401`; response does not reveal whether the email or password was wrong. |
| AUTH-10 | Unknown user | Use unknown email/cédula and any password. | `401`; no token is issued. |
| AUTH-11 | Empty login fields | Submit blank, missing, and whitespace-only credentials. | `400` validation error; no database lookup side effects. |
| AUTH-12 | Refresh token | Login, call refresh, then use the new access token. | New token pair works; invalid/expired/reused refresh token is rejected. |
| AUTH-13 | Logout | Login, logout with the refresh token, then refresh it. | Logout succeeds; invalidated refresh token cannot be reused. |
| AUTH-14 | Forgot password | Submit a registered email, unregistered email, blank email, and malformed email. | Valid request follows recovery behavior without leaking account existence; invalid input is `400`. |
| AUTH-15 | Reset password | Use a valid reset token, expired token, reused token, and weak new password. | Only a valid unused token changes the password; invalid tokens/passwords are rejected. |
| AUTH-16 | Change password | As an authenticated user, submit correct current password and valid new password. | Password changes; old password fails and new password succeeds. |
| AUTH-17 | Wrong current password | Attempt password change with an incorrect current password. | Request is rejected; password remains unchanged. |
| AUTH-18 | Enable 2FA | Authenticated user enables 2FA. | Secret and QR/otpauth value are returned; repeated enable behavior is defined and consistent. |
| AUTH-19 | Verify 2FA login | Enable 2FA, log in, submit valid and invalid OTP codes. | Valid OTP completes login; invalid/expired OTP is rejected. |
| AUTH-20 | Password disclosure | Inspect login, user list, user detail, logs, and browser storage. | Plain passwords and password hashes are never exposed. |
| USER-01 | Public registration | Register an ADMIN_EMPRESA with valid person data and a unique email/cédula. | User is created as `PENDIENTE_VALIDACION`; no login before approval. |
| USER-02 | Registration validation | Omit each required person field; use invalid email, duplicate email/cédula, weak password, and disallowed role id. | `400` or `409` as appropriate; no partial user/person record remains. |
| USER-03 | Registration attachment | Upload a `CARTA_AUTORIZACION`, then reference its id during registration. | Attachment is associated with the registration and is visible to the approving admin. |
| USER-04 | Approve registration | ADMIN opens pending users and approves one. | Status becomes `APROBADO`; user can log in. |
| USER-05 | Reject registration | ADMIN rejects a pending user with and without rejection reason. | Status becomes `RECHAZADO`; user cannot log in; reason is retained when supplied. |
| USER-06 | User permissions | Try user list, role catalog, status update, delete, and profile update with each role. | Only documented roles/actions succeed; all others return `403`. |
| USER-07 | Self-service profile | User reads/updates own profile and attempts to update another user. | Own permitted update succeeds; cross-user update is denied unless ADMIN. |
| USER-08 | Deactivation | ADMIN deactivates a user, then that user attempts login and refresh. | User cannot start or continue an authenticated session. |

## 5. Institutions and Catalogs - RF-03

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| INST-01 | Catalog loading | Load provinces, municipalities by province, categories, subcategories, foods, and health areas. | Lists load; municipality results match selected province; empty filters are handled. |
| INST-02 | Create institution | ADMIN_EMPRESA submits all required institution fields and a municipality. | Institution is created and belongs to that company. |
| INST-03 | Institution validation | Omit required fields, use duplicate RNC, invalid municipality, invalid email, and extreme field lengths. | Validation/conflict errors are clear; no invalid record is created. |
| INST-04 | Edit institution | ADMIN_EMPRESA edits own institution; ADMIN edits an institution; another company tries. | Owner and ADMIN actions succeed according to contract; other company receives `403`. |
| INST-05 | Representatives | Add Legal, Calidad, and Contacto representatives; edit and delete each. | Correct type and person data are persisted; unauthorized roles are denied. |
| INST-06 | Institution visibility | Query own institution as company roles and query another company as each role. | Company roles are scoped to their institution; ADMIN/COORDINADOR/TECHNICIAN access follows the implemented contract. |
| INST-07 | Institution history | Open institution history and previous evaluations. | Cases, evaluations, permits, scores, and reports are correctly linked and read-only where required. |
| INST-08 | Pagination/filtering | Use page/pageSize, search, RNC, province, municipality, sort, and invalid query values. | Pagination metadata is correct; filters do not leak records outside the user scope. |

## 6. Company BPM Request Workflow - RF-04/RF-05

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| BPM-01 | Company dashboard | Login as ADMIN_EMPRESA and USUARIO_DELEGADO. | Dashboard shows own requests, evaluations, and unread notifications only. |
| BPM-02 | Create draft | Create a request with institution, establishment type, reason, and observations. | Request is saved as `BORRADOR`. |
| BPM-03 | Draft validation | Submit missing institution/type/reason, invalid institution, and excessive text. | `400`; draft is not created or is not corrupted. |
| BPM-04 | Edit draft | Author edits a draft; coordinator, other company user, and non-author attempt edit. | Only the author can edit while status is `BORRADOR`. |
| BPM-05 | Required documents | Attach valid and invalid file types/sizes to a draft. | Required documentation rules are enforced; metadata and association are correct. |
| BPM-06 | Submit complete request | Submit a draft with all required information and documents. | Status becomes `PENDIENTE_ASIGNACION`; exactly one linked `Case` is created with origin `SOLICITUD_EMPRESA`. |
| BPM-07 | Submit incomplete request | Submit without required documentation or from a non-draft state. | Request is rejected; no duplicate case is created. |
| BPM-08 | Request visibility | Query request list/detail as author, delegated company user, coordinator, admin, technician, and unrelated company. | Access matches the contract and company scope. |
| BPM-09 | Duplicate submit/race | Double-click submit or repeat the submit request. | Only one valid transition/case exists; second attempt returns a conflict or invalid-state error. |

## 7. Cases, Scheduling, and Assignment - RF-06/RF-07/RF-10/RF-11

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| CASE-01 | Institutional case | COORDINADOR creates a case with institution, priority, and reason. | Case is created with origin `PROGRAMACION_INSTITUCIONAL`. |
| CASE-02 | Case origins | Create cases from BPM request, LAPCH alert, and complaint. | Each case stores the correct origin and source relation. |
| CASE-03 | Case filters | ADMIN/COORDINADOR filter by origin, status, priority, institution, and technician. | Results and pagination are accurate. |
| CASE-04 | Priority | Coordinator changes priority to each valid value and tries invalid values. | Valid transition persists; invalid values return `400`. |
| CASE-05 | Assign evaluator | Coordinator assigns tecnico1. | Assignment is recorded; case/evaluation reflects the assigned technician. |
| CASE-06 | Reassign evaluator | Reassign from tecnico1 to tecnico2. | New assignment is recorded with `isReassignment = true`; history remains intact. |
| CASE-07 | Assignment restrictions | Non-coordinator assigns/reassigns; assign non-technician; assign nonexistent user. | All invalid attempts are rejected with correct status. |
| CASE-08 | Case access | ADMIN, COORDINADOR, assigned TECHNICIAN, unassigned TECHNICIAN, and company user open case detail. | Access follows ownership and role rules; unrelated users cannot view restricted details. |
| CASE-09 | Schedule evaluation | Coordinator schedules an assigned case with valid ISO date and priority. | Evaluation is created with correct date, reason, priority, and technician. |
| CASE-10 | Reschedule | Reschedule an evaluation, then try invalid date, cancelled evaluation, and non-coordinator. | Valid reschedule sets `REPROGRAMADA`; invalid state/role is rejected. |
| CASE-11 | Cancel | Coordinator cancels a scheduled evaluation and repeats cancellation. | First action sets `CANCELADA`; repeated/invalid transition is rejected. |
| CASE-12 | Calendar views | Technician opens day, week, and month ranges containing assigned and unassigned evaluations. | Only own assignments appear with correct date, address, and status. |
| CASE-13 | Scheduling conflicts | Schedule overlapping evaluations for a technician and invalid date ranges. | Conflict behavior is consistent and does not silently overwrite an existing schedule. |

## 8. LAPCH Alerts and Complaints - RF-08/RF-09

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| SOURCE-01 | Create LAPCH alert | Coordinator/admin submits alert number, date, product, institution, and description. | Alert is created; duplicate alert number is rejected. |
| SOURCE-02 | Alert result | Set result to `PROCEDE` and `NO_PROCEDE`; repeat from invalid state. | Result persists; only coordinator can set it; invalid transitions are rejected. |
| SOURCE-03 | Alert case | Generate case from a `PROCEDE` alert; try from `NO_PROCEDE`. | One case is generated with origin `ALERTA_LAPCH` only when appropriate. |
| SOURCE-04 | Close alert | Coordinator closes an alert without generating an evaluation. | Alert/case closes according to business status and cannot be processed again incorrectly. |
| SOURCE-05 | Create complaint | Submit public complaint with all fields, with optional institution, and with missing fields. | Valid complaint is accepted; invalid request receives validation feedback. |
| SOURCE-06 | Complaint result | Coordinator sets `PROCEDE`, `NO_PROCEDE`, and `REMISION_OTRO_PROCESO`. | Each result is stored and displayed correctly. |
| SOURCE-07 | Complaint case | Generate case only for a proceeding complaint. | Case has origin `DENUNCIA`; duplicate generation is prevented. |
| SOURCE-08 | Source access | Attempt alert/complaint list, detail, result, and generation with every role. | Public creation works only as intended; management actions are restricted to ADMIN/COORDINADOR. |

## 9. Field Evaluation, Form, Evidence, and Risk - RF-12 to RF-15

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| FIELD-01 | Template access | Load the form tree as ADMIN, COORDINADOR, assigned technician, company user, and unassigned technician. | Template list/tree access matches the contract; hierarchy is complete and ordered. |
| FIELD-02 | Start evaluation | Assigned technician starts a scheduled evaluation; repeat start and try as another role. | Status becomes `EN_PROCESO` and one empty form response is created. |
| FIELD-03 | Save partial answers | Save C, CP, NC, and N/A answers in multiple batches, then reload. | Answers are upserted without losing previous answers; invalid question/value is rejected. |
| FIELD-04 | Form completeness | Attempt finish with missing required answers and with all sections answered. | Incomplete form is rejected if required; complete form can finish. |
| FIELD-05 | Finish evaluation | Finish a valid evaluation. | Status becomes `FINALIZADA`; score and report are generated automatically. |
| FIELD-06 | Finish restrictions | Non-assigned technician, coordinator, company user, and already finished evaluation attempt finish. | All invalid attempts are rejected. |
| FIELD-07 | Evidence upload | Upload photo, video, and document with comment and optional coordinates. | Correct type, metadata, file URL, and association are saved. |
| FIELD-08 | Evidence validation | Upload unsupported type, oversized file, missing type, invalid coordinates, and empty file. | Upload is rejected safely; no orphan metadata/file remains. |
| FIELD-09 | Evidence deletion | Assigned technician deletes evidence before finish; delete after finish and as another user. | Only allowed pre-finish deletion succeeds. |
| FIELD-10 | Risk calculation | Finish evaluations with all C, all NC, mixed CP/NC, and N/A answers. | Score, percentage, risk level, and inspection frequency match the configured rules; N/A is excluded as specified. |
| FIELD-11 | Risk boundaries | Test values exactly at and just below/above every risk-frequency threshold. | Classification changes at the documented boundaries and never produces an undefined level. |
| FIELD-12 | Risk rule administration | ADMIN reads and edits risk-frequency rules; other roles attempt read/edit. | ADMIN can edit valid rules; others are denied; invalid thresholds are rejected. |
| FIELD-13 | Geolocation | Upload evidence with valid coordinates, no coordinates, zero coordinates, and out-of-range coordinates. | Optional valid coordinates persist; invalid coordinates are rejected or normalized consistently. |
| FIELD-14 | Offline form entry | Load an assigned evaluation, disable network, answer/save locally, close/reopen the PWA. | Work continues offline and local answers survive reload. |
| FIELD-15 | Offline sync | Restore network and trigger automatic/manual sync; simulate a failed sync. | Valid local changes sync once; failed items remain queued and are retryable without duplication. |

## 10. Reports, Review, Corrections, and Closure - RF-16 to RF-19

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| REPORT-01 | Generated report | Finish evaluation and open report. | Report contains executive summary, findings, nonconformities, recommendations, and evidence references. |
| REPORT-02 | Submit report | Assigned technician submits a draft report. | Status becomes `ENVIADO`; report is locked. |
| REPORT-03 | Locked evaluation | After submission, try changing form answers and deleting evidence. | Backend rejects locked-data changes with `403` or documented locked-state error. |
| REPORT-04 | Review approve | Coordinator approves a submitted report. | Review is recorded; report/evaluation state becomes approved and is no longer editable. |
| REPORT-05 | Review return | Coordinator returns a report with comments. | Comments are visible to the technician; correction is enabled. |
| REPORT-06 | Request correction | Coordinator requests correction with and without comments. | Correct review action/status is stored; technician sees the request. |
| REPORT-07 | Correct report | Technician edits allowed report fields after return. | Version increments; report unlocks only during correction; unauthorized fields/actions remain blocked. |
| REPORT-08 | Resend correction | Technician resends corrected report. | Status returns to `ENVIADO`, lock is restored, and review history keeps prior actions. |
| REPORT-09 | Invalid review transitions | Approve a draft, review as technician, review twice, and review nonexistent report. | Invalid role/state/id returns the correct error and creates no phantom review. |
| REPORT-10 | Close case | Coordinator closes a fully processed case with final result and `emitirInforme` true/false. | Case becomes `CERRADO`, close date is set, and official PDF is generated only when requested. |
| REPORT-11 | Close restrictions | Close without approved report, as non-coordinator, or repeat close. | Operation is rejected when prerequisites or role are invalid. |
| REPORT-12 | Official PDF | Download official PDF as ADMIN, owning ADMIN_EMPRESA, unrelated company, technician, and coordinator. | Access follows the contract; PDF opens, has non-empty content, correct case/institution, and no broken attachment links. |

## 11. History and Notifications - RF-20/RF-04

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| HIST-01 | Search by entity | Search cases, evaluations, and BPM requests. | Results identify entity type, id, institution, status, and creation date. |
| HIST-02 | Search filters | Filter by institution, request, evaluation, date range, status, page, and sort. | Filters combine correctly; invalid dates/page values are rejected. |
| HIST-03 | Company history scope | ADMIN_EMPRESA searches broadly and for another institution. | Results are limited to that company. |
| HIST-04 | History access | Try history as USUARIO_DELEGADO and TECNICO_EVALUADOR. | Access matches the implemented contract and does not expose unauthorized records. |
| NOTIF-01 | Notification list | Login as each role and filter unread/read notifications. | Only own notifications appear and read filter works. |
| NOTIF-02 | Mark one read | Mark an unread notification as read, then repeat. | Read state changes once; repeat is idempotent or returns a documented conflict. |
| NOTIF-03 | Mark all read | Mark all notifications read and reload dashboard. | All own notifications are read and unread count reaches zero. |
| NOTIF-04 | Notification isolation | Attempt to mark another user notification by id. | Operation is denied or returns not found without changing the other user. |

## 12. Attachments - RF-02/RF-05/RF-15/RF-17

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| FILE-01 | Generic upload | Authenticated user uploads each supported attachment category using multipart form data. | File and metadata are stored; returned id can be associated with the owning workflow. |
| FILE-02 | Upload validation | Omit file/category, use unsupported category, oversized file, and disallowed MIME type. | Request is rejected with no orphan database record. |
| FILE-03 | Attachment access | Uploader reads/deletes own attachment; ADMIN reads/deletes it; another user tries. | Uploader and ADMIN succeed; unrelated user is forbidden. |
| FILE-04 | Workflow ownership | Access an attachment through its BPM request, evidence, report, and registration owner. | Access matches the owning entity contract, not merely a UI link. |
| FILE-05 | Path safety | Try ids/path values that could escape the uploads directory. | Request is validated; filesystem access remains inside the upload directory. |
| FILE-06 | File cleanup | Delete an attachment and inspect metadata plus physical file. | Database record and physical file are removed or documented best-effort behavior is observed. |

Current implementation note: the generic attachment service currently authorizes GET/DELETE using uploader-or-ADMIN ownership. The API contract describes access through the owning entity, so FILE-04 is a required gap check before release.

## 13. API Contract and Error Handling Checks

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| API-01 | Response envelope | Inspect successful and failed responses across every module. | Envelope follows `valid`, `data`, and `error` conventions consistently. |
| API-02 | Authentication errors | Call every protected module with no token, malformed token, expired token, and revoked token. | All protected routes consistently return `401`. |
| API-03 | Authorization errors | Call each role-restricted endpoint with a valid but wrong-role token. | Returns `403`; no mutation occurs. |
| API-04 | Missing resources | Use nonexistent ids for GET, PATCH, POST action, and DELETE. | Returns `404`; no side effect occurs. |
| API-05 | Invalid transitions | Repeat every state transition after completion/cancellation/closure. | Returns `400` or `409` consistently; state remains unchanged. |
| API-06 | Pagination limits | Test default, zero, negative, maximum, over-maximum, and nonnumeric page values. | Defaults and maximums are enforced; no unbounded response is returned. |
| API-07 | Sorting/filter injection | Use unknown sort fields and special characters in search/filter fields. | Invalid fields are rejected or safely ignored; no SQL/ORM error leaks. |
| API-08 | Duplicate mutations | Repeat create, submit, assign, review, close, and delete requests. | Operations are idempotent or return a controlled conflict; records are not duplicated. |
| API-09 | Database failure behavior | Stop/restart the database during a non-destructive request. | User receives controlled `5xx` error; no partial success is reported. |
| API-10 | Auditability | Perform approval, assignment, review, correction, and close actions. | Relevant actor, timestamp, status, and history are retained. |

## 14. PWA, Browser, Device, and Accessibility Checks - RNF-01/RNF-05

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| PWA-01 | Installability | Install from Chrome/Edge desktop and a supported mobile browser. | Manifest, app name/icon, and install prompt are valid; installed app opens. |
| PWA-02 | Service worker | Inspect service worker registration and reload. | Service worker registers without errors and updates according to its cache strategy. |
| PWA-03 | Offline startup | Install/load the app, disable network, restart it. | App shell opens offline and shows an understandable offline state. |
| PWA-04 | Network recovery | Switch offline/online repeatedly while editing. | Queued work is not lost or duplicated; sync status is visible. |
| PWA-05 | Responsive layout | Test 320px mobile, tablet, laptop, and wide desktop widths. | No clipped controls, overlapping text, unusable dialogs, or horizontal overflow in core workflows. |
| PWA-06 | Supported browsers | Run smoke flow in Chrome, Edge, Firefox, and Safari. | Login, navigation, forms, upload, download, and offline behavior work or have documented limitations. |
| PWA-07 | Supported devices | Run smoke flow on Android, iOS, Windows, and macOS. | Touch, keyboard, camera/file picker, date controls, and download behavior are usable. |
| A11Y-01 | Keyboard access | Navigate login, menus, forms, modals, tabs, and tables with keyboard only. | Focus order is logical; all actions are reachable; focus is visible. |
| A11Y-02 | Screen reader labels | Inspect inputs, buttons, dialogs, tabs, status messages, and validation errors. | Controls have meaningful accessible names and state changes are announced. |
| A11Y-03 | Visual states | Test error, disabled, loading, selected, unread, offline, and success states. | State is not communicated by color alone and remains readable at zoom. |

## 15. Recommended Execution Order

1. Run ENV-01 setup and confirm the database, frontend, backend, and seed data.
2. Run AUTH-01 through AUTH-20 and record tokens/accounts used.
3. Run INST and BPM cases to create fresh business data.
4. Run CASE and SOURCE cases to create assigned evaluations.
5. Run FIELD cases, including the risk boundary set and offline set.
6. Run REPORT cases through official closure.
7. Run HIST and NOTIF cases against the records created above.
8. Run FILE and API negative matrices.
9. Run PWA/browser/device/accessibility checks.
10. Rerun `pnpm test:api` and attach its output to the test evidence.

## 16. Release Exit Criteria

- All critical happy paths pass: login, registration approval, institution, BPM request, case, assignment, field evaluation, risk score, report review, correction, and closure.
- No role can perform a forbidden mutation through either the UI or direct API calls.
- No unresolved data-loss, duplicate-transition, authentication, authorization, or file-access defects remain.
- Offline work either synchronizes correctly or remains recoverable in the local queue.
- All P0/P1 defects are closed or explicitly accepted with owner and workaround.
- Failed cases include reproducible steps, expected/actual result, role, ids, request payload (without secrets), screenshots/logs, and environment.

## 17. Test Record Template

Copy this block for each executed case:

```text
Case ID:
Date/time:
Tester:
Environment/browser/device:
Account/role:
Preconditions and record ids:
Steps performed:
Expected result:
Actual result:
PASS / FAIL / BLOCKED:
Evidence:
Defect id:
Notes:
```
