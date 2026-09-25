/**
 * reset-test-state.mjs
 * ---------------------------------------------------------------------------
 * Resets mutable test state before the API suite. Currently disables 2FA for
 * every user — seeded accounts must remain usable without OTP.
 *
 * Called by `pnpm test:api:full`. Fails loudly if Postgres is unreachable.
 * ---------------------------------------------------------------------------
 */

import { execFileSync } from 'node:child_process';

const CONTAINER = process.env.TEST_PG_CONTAINER ?? 'mi-postgres2';
const USER = process.env.TEST_PG_USER ?? 'miusuario';
const DB = process.env.TEST_PG_DB ?? 'midb2';
const SQL = 'UPDATE two_factor_auth SET enabled = false WHERE enabled = true';

try {
  const result = execFileSync(
    'docker',
    ['exec', CONTAINER, 'psql', '-U', USER, '-d', DB, '-c', SQL],
    { encoding: 'utf8', timeout: 15000 },
  );
  console.log('✓ Test state reset: 2FA disabled for all users.');
  if (result.trim()) console.log('  DB output:', result.trim());
} catch (err) {
  console.error('✗ Could not reset 2FA state. The API suite will not run with a dirty 2FA flag.');
  console.error('  Start PostgreSQL with `pnpm db:up` and confirm the container is named', CONTAINER);
  console.error(' ', err.message?.split('\n')[0] ?? String(err));
  process.exit(1);
}
