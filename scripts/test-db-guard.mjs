/**
 * test-db-guard.mjs
 * ---------------------------------------------------------------------------
 * Shared safety rules for any script that mutates PostgreSQL during tests.
 *
 * The local compose database `midb2` is treated as shared/dev data. Tests may
 * only run mutating SQL (disable 2FA, cleanup, seed) against an explicitly
 * allowlisted disposable database.
 *
 * This module never prints connection secrets.
 * ---------------------------------------------------------------------------
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..');

export const ALLOWED_TEST_DATABASES = Object.freeze(['radar_test']);
export const BLOCKED_DATABASES = Object.freeze([
  'midb2',
  'postgres',
  'template0',
  'template1',
]);

export function loadRootEnv() {
  const envPath = path.join(REPO_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export function databaseNameFromUrl(url) {
  if (!url) throw new Error('DATABASE_URL is missing');
  const parsed = new URL(url);
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, '')).split('/')[0];
  if (!name) throw new Error('DATABASE_URL has no database name');
  return name;
}

export function withDatabaseName(url, dbName) {
  const parsed = new URL(url);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

export function assertDisposableDatabase(dbName, action) {
  const name = String(dbName ?? '').trim();
  if (BLOCKED_DATABASES.includes(name)) {
    throw new Error(
      `Refusing to ${action} database "${name}". That name is blocked because it is shared, system, or production-like data.`,
    );
  }
  if (!ALLOWED_TEST_DATABASES.includes(name)) {
    throw new Error(
      `Refusing to ${action} database "${name}". Allowed disposable test databases: ${ALLOWED_TEST_DATABASES.join(', ')}.`,
    );
  }
  return name;
}

export function resolveTestDatabase() {
  loadRootEnv();
  const requested = process.env.TEST_PG_DB ?? 'radar_test';
  return assertDisposableDatabase(requested, 'target');
}

export function resolveTestDatabaseUrl() {
  loadRootEnv();
  const dbName = resolveTestDatabase();
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('DATABASE_URL is not set; cannot derive the disposable test connection.');
  }
  const liveName = databaseNameFromUrl(base);
  if (liveName === dbName) return base;
  return withDatabaseName(base, dbName);
}

export function runPnpm(args, options = {}) {
  const isWin = process.platform === 'win32';
  return execFileSync(isWin ? 'pnpm.cmd' : 'pnpm', args, {
    encoding: 'utf8',
    shell: isWin,
    ...options,
  });
}

export function dockerExecPsql(dbName, sql, extraArgs = []) {
  const container = process.env.TEST_PG_CONTAINER ?? 'mi-postgres2';
  const user = process.env.TEST_PG_USER ?? 'miusuario';
  try {
    return execFileSync(
      'docker',
      ['exec', container, 'psql', '-U', user, '-d', dbName, '-t', '-A', ...extraArgs, '-c', sql],
      { encoding: 'utf8', timeout: 20_000 },
    ).trim();
  } catch (err) {
    throw new Error(
      `psql in container ${container} (db=${dbName}) failed: ${err.message?.split('\n')[0] ?? err}`,
    );
  }
}

export function databaseExists(dbName) {
  const container = process.env.TEST_PG_CONTAINER ?? 'mi-postgres2';
  const user = process.env.TEST_PG_USER ?? 'miusuario';
  const sql = `SELECT 1 FROM pg_database WHERE datname = '${dbName.replace(/'/g, "''")}'`;
  try {
    return execFileSync(
      'docker',
      ['exec', container, 'psql', '-U', user, '-d', 'postgres', '-t', '-A', '-c', sql],
      { encoding: 'utf8', timeout: 15_000 },
    ).trim() === '1';
  } catch (err) {
    throw new Error(`Could not inspect Postgres databases: ${err.message?.split('\n')[0] ?? err}`);
  }
}

export function createDatabaseIfMissing(dbName) {
  assertDisposableDatabase(dbName, 'create');
  if (databaseExists(dbName)) return false;
  const container = process.env.TEST_PG_CONTAINER ?? 'mi-postgres2';
  const user = process.env.TEST_PG_USER ?? 'miusuario';
  execFileSync(
    'docker',
    ['exec', container, 'psql', '-U', user, '-d', 'postgres', '-c', `CREATE DATABASE ${dbName}`],
    { encoding: 'utf8', timeout: 20_000 },
  );
  return true;
}
