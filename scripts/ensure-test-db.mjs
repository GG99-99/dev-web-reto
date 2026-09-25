/**
 * ensure-test-db.mjs
 * ---------------------------------------------------------------------------
 * Creates, migrates, and seeds the disposable Playwright/API test database.
 * Never drops, truncates, or migrates `midb2`.
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ALLOWED_TEST_DATABASES,
  REPO_ROOT,
  assertDisposableDatabase,
  createDatabaseIfMissing,
  databaseExists,
  databaseNameFromUrl,
  dockerExecPsql,
  loadRootEnv,
  resolveTestDatabase,
  resolveTestDatabaseUrl,
  runPnpm,
} from './test-db-guard.mjs';

loadRootEnv();

const dbName = resolveTestDatabase();
assertDisposableDatabase(dbName, 'prepare');
const testUrl = resolveTestDatabaseUrl();
const liveUrl = process.env.DATABASE_URL ?? '';
const liveName = liveUrl ? databaseNameFromUrl(liveUrl) : '(unset)';

console.log(`Test database target: ${dbName}`);
console.log(`Backend .env currently names: ${liveName}`);
console.log(`Allowed disposable databases: ${ALLOWED_TEST_DATABASES.join(', ')}`);

if (liveName && liveName !== dbName) {
  console.log(`Leaving shared database "${liveName}" untouched.`);
  try {
    const migrationTable = dockerExecPsql(
      liveName,
      "SELECT to_regclass('public._prisma_migrations') IS NOT NULL",
    );
    if (migrationTable === 't' || migrationTable === 'true') {
      const count = dockerExecPsql(liveName, 'SELECT COUNT(*) FROM _prisma_migrations');
      console.log(`Read-only inspect of ${liveName}: _prisma_migrations has ${count} row(s). No schema changes applied.`);
    } else {
      console.log(
        `Read-only inspect of ${liveName}: no _prisma_migrations table (historical P3005 condition). Not resolving migration history.`,
      );
    }
  } catch (err) {
    console.log(
      `Read-only inspect of ${liveName} failed (${err.message?.split('\n')[0] ?? err}). Not mutating that database.`,
    );
  }
}

if (!databaseExists(dbName)) {
  console.log(`Creating disposable database ${dbName}…`);
  createDatabaseIfMissing(dbName);
} else {
  console.log(`Disposable database ${dbName} already exists.`);
}

const dbDist = path.join(REPO_ROOT, 'packages', 'db', 'dist', 'index.js');
if (!fs.existsSync(dbDist)) {
  console.log('Building workspace packages required for seed…');
  runPnpm(['build:packages'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: 180_000,
    env: process.env,
  });
}

console.log(`Applying Prisma migrations to ${dbName} only…`);
runPnpm(
  ['--filter', '@reto/db', 'exec', 'prisma', 'migrate', 'deploy'],
  {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: 120_000,
    env: { ...process.env, DATABASE_URL: testUrl },
  },
);

let userCount = '0';
try {
  userCount = dockerExecPsql(dbName, 'SELECT COUNT(*) FROM "user"');
} catch {
  userCount = '0';
}

if (Number(userCount) > 0) {
  console.log(`Seed already present on ${dbName} (${userCount} users). Not reseeding.`);
} else {
  console.log(`Seeding ${dbName}…`);
  runPnpm(
    ['--filter', '@reto/backend', 'seed'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: 180_000,
      env: { ...process.env, DATABASE_URL: testUrl },
    },
  );
}

console.log(`Disposable test database ${dbName} is ready.`);
