/**
 * start-test-backend.mjs
 * ---------------------------------------------------------------------------
 * Starts the Express API against the disposable test database on a dedicated
 * port so Playwright never mutates the shared `midb2` instance.
 * ---------------------------------------------------------------------------
 */

import { spawn } from 'node:child_process';
import {
  REPO_ROOT,
  loadRootEnv,
  resolveTestDatabase,
  resolveTestDatabaseUrl,
} from './test-db-guard.mjs';

loadRootEnv();
const dbName = resolveTestDatabase();
const databaseUrl = resolveTestDatabaseUrl();
const port = process.env.E2E_API_PORT ?? '3010';
const webPort = process.env.E2E_WEB_PORT ?? '5174';

console.log(`Starting test backend on port ${port} using database ${dbName}`);

const isWin = process.platform === 'win32';
const child = spawn(isWin ? 'pnpm.cmd' : 'pnpm', ['--filter', '@reto/backend', 'dev'], {
  cwd: REPO_ROOT,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PORT: String(port),
    SMTP_HOST: '',
    CORS_ORIGIN: [
      `http://127.0.0.1:${webPort}`,
      `http://localhost:${webPort}`,
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ].join(','),
  },
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
