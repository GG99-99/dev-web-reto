# RADAR Sanitario

Web application for sanitary inspection of food establishments: company registration, case assignment, field evaluations, coordinator review, and official reports. A QR on an approved report opens a public check that confirms the document was issued by this system. Anyone can also file a complaint without an account.

The repo is a pnpm workspace:

| Path | Role |
|------|------|
| `apps/backend` | API on port **3000** (`/api/v1`) |
| `apps/frontend` | React app. Dev server on port **5173**, proxied to the API |
| `packages/db` | Prisma schema, migrations, and database client |
| `packages/shared` | Types shared by the API and the UI |
| `docker-pg` | PostgreSQL 16 for local use |

## What you need

- [Node.js](https://nodejs.org/) 20 or newer
- [pnpm](https://pnpm.io/) 10 or newer (this lockfile was written with pnpm 12)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running, so Postgres can start

From the repository root:

```powershell
corepack enable
corepack prepare pnpm@12.3.4 --activate
pnpm install
```

## Configure

Create `.env` in the repository root. Both the API and Prisma load that file, not a copy inside `apps/backend`.

```powershell
Copy-Item .env.example .env
```

The example matches the Docker Compose database (`miusuario` / `1234`, host port **5433**, database `midb2`). Change the JWT secrets before you share a machine. Leave `SMTP_HOST` empty if you do not have a mailbox yet: assignment and recovery messages are printed in the backend terminal.

`APP_PUBLIC_URL` is the link placed in password-recovery mail. `PUBLIC_APP_URL` is the address encoded in report QR codes. On one computer, `http://localhost:5173` is enough for development. A phone can open a QR only if that URL is a host the phone can reach (your LAN IP or a public name), not `localhost`.

## Database

Start Postgres, apply migrations, then load the demo accounts and catalogs.

```powershell
pnpm db:up
pnpm db:migrate
pnpm seed
```

`pnpm db:down` stops the container. Data stays in the `pgdata` Docker volume. `pnpm db:logs` follows the Postgres log.

Every seeded user uses the password `Password123!`.

| Role | Email |
|------|--------|
| Platform admin | `admin@salud.gob.do` |
| Coordinator | `coordinador@salud.gob.do` |
| Field technician | `tecnico1@salud.gob.do` |
| Field technician | `tecnico2@salud.gob.do` |
| Company admin | `admin@lacteosdelnorte.do` |
| Company delegate | `delegado@lacteosdelnorte.do` |

Automated tests use a separate database, `radar_test`, and do not reset `midb2`. See [tests/README.md](tests/README.md).

## Run it on your machine

Development (API with reload, and the Vite UI):

```powershell
pnpm dev
```

- App: http://localhost:5173
- API: http://localhost:3000/api/v1

`pnpm dev:full` starts Postgres and then the same two processes. `pnpm dev:backend` and `pnpm dev:frontend` start one side only. The frontend dev server proxies `/api` to port 3000, so you do not set an API URL for normal local use.

One process that serves the built UI and the API (closer to a deployed machine):

```powershell
pnpm prod
```

That starts Postgres, builds the shared packages and the frontend, then serves http://localhost:3000. For that mode set both public URLs in `.env` to `http://localhost:3000` (or the address other devices will use) before you generate QR codes or recovery links.

Sign in with one of the seeded accounts above. From the signed-out screen you can verify a document or file a complaint. An approved official report shows a QR; scanning it opens `/?verify=...`. A public complaint is `/?complaint=1`.

## Mail

With `SMTP_HOST` empty, nothing is sent. The message text appears in the backend console, which is enough to try password recovery locally.

To send real mail, set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`. For Gmail, create an [app password](https://support.google.com/accounts/answer/185833) and put that in `SMTP_PASS` (spaces are ignored). Port **587** with `SMTP_SECURE=false` is the usual start. If that port never connects, use port **465** and `SMTP_SECURE=true`. The mailer also retries the other port when the first one times out.
