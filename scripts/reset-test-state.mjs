/**
 * reset-test-state.mjs
 * ---------------------------------------------------------------------------
 * Resets mutable test state before the API suite. Currently disables 2FA for
 * every user in the disposable test database only.
 *
 * Called by `pnpm test:api:full`. Fails loudly if Postgres is unreachable or
 * if the configured database is not in the disposable allowlist.
 * ---------------------------------------------------------------------------
 */

import {
  dockerExecPsql,
  loadRootEnv,
  resolveTestDatabase,
} from './test-db-guard.mjs';

loadRootEnv();

const SQL = 'UPDATE two_factor_auth SET enabled = false WHERE enabled = true';

try {
  const db = resolveTestDatabase();
  const result = dockerExecPsql(db, SQL);
  console.log(`✓ Test state reset on disposable database ${db}: 2FA disabled.`);
  if (result) console.log('  DB output:', result);
} catch (err) {
  console.error('✗ Could not reset 2FA state. Refusing to mutate an unapproved database.');
  console.error('  Create the disposable DB with `pnpm test:db:ensure` (database name radar_test).');
  console.error(' ', err.message?.split('\n')[0] ?? String(err));
  process.exit(1);
}
