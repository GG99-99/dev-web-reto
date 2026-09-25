/**
 * start-test-frontend.mjs
 * ---------------------------------------------------------------------------
 * Vite dev server for Playwright, proxied to the dedicated test API port.
 * ---------------------------------------------------------------------------
 */

import { spawn } from 'node:child_process';
import { REPO_ROOT, loadRootEnv } from './test-db-guard.mjs';

loadRootEnv();
const webPort = process.env.E2E_WEB_PORT ?? '5174';
const apiPort = process.env.E2E_API_PORT ?? '3010';

console.log(`Starting test frontend on port ${webPort}, API proxy ${apiPort}`);

const isWin = process.platform === 'win32';
const child = spawn(
  isWin ? 'pnpm.cmd' : 'pnpm',
  ['--filter', '@reto/frontend', 'exec', 'vite', '--port', String(webPort), '--strictPort', '--host', '127.0.0.1'],
  {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
      VITE_DEV_PORT: String(webPort),
    },
    stdio: 'inherit',
    shell: true,
  },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
