# Running RADAR locally

The repository is a pnpm workspace. The easiest development setup is two commands: one to start the local PostgreSQL database and one to start both application servers.

## Prerequisites

- Node.js 20 or newer
- pnpm (version 10 or newer)
- Docker Desktop, with its Linux containers engine running

Corepack is not required. If pnpm is not installed, install it with `npm install --global pnpm` (an Administrator PowerShell may be required when Node was installed for all users).

## First-time setup

From the repository root (`dev-web-reto`):

```powershell
pnpm install
```

The repository already includes a development `.env`. If it is missing, copy the template before continuing:

```powershell
Copy-Item env-example.txt .env
```

Start PostgreSQL and apply the Prisma migrations:

```powershell
pnpm db:up
pnpm db:migrate
pnpm seed
```

The seed command also builds the shared workspace packages first. Seeding is safe to repeat; existing records are skipped by the seeders.

## Start the whole app

Open a terminal in the repository root and run:

```powershell
pnpm dev
```

This launches both processes in parallel:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:3000/api/v1>

Keep this terminal open. Press `Ctrl+C` to stop both development servers. The PostgreSQL container keeps running so the next start is fast.

After the first-time setup, `pnpm dev:full` is a shortcut that starts PostgreSQL and then launches both application servers:

```powershell
pnpm dev:full
```

To stop PostgreSQL as well:

```powershell
pnpm db:down
```

## Useful individual commands

```powershell
pnpm dev:frontend   # frontend only
pnpm dev:backend    # backend only
pnpm db:logs        # follow PostgreSQL logs
pnpm db:up          # start PostgreSQL again after db:down
```

If Docker is not available, the backend can still be started with `pnpm dev:backend`, but it will only work when `DATABASE_URL` points to a reachable PostgreSQL instance. The frontend can be previewed independently with `pnpm dev:frontend`.

## Troubleshooting

- `docker is not recognized`: install/start Docker Desktop, then rerun `pnpm db:up`.
- Database connection errors: check that PostgreSQL is running on port `5433` and that `.env` matches `env-example.txt`.
- Port already in use: stop the process using port `3000` or `5173`, or change `PORT` in `.env` for the backend. The frontend proxy expects the backend on port `3000`.
- Missing packages: run `pnpm install` again from the repository root.
