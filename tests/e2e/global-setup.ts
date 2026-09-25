/**
 * Ensures the disposable Playwright database exists before any browser starts.
 * Does not start servers; Playwright webServer handles that.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default async function globalSetup() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  execFileSync('node', ['scripts/ensure-test-db.mjs'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
}
