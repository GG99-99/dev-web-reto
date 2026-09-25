/**
 * helpers.mjs
 * ---------------------------------------------------------------------------
 * Shared utilities for the RADAR API test suite.
 * Node.js built-ins only (fetch, FormData, Blob, crypto).
 * ---------------------------------------------------------------------------
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

export const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3010/api/v1';
export const PASSWORD = process.env.TEST_PASSWORD ?? 'Password123!';

/** Seeded test accounts from users.seeder.ts / persons.seeder.ts */
export const ACCOUNTS = {
  admin: { usuario: process.env.TEST_ADMIN ?? 'admin@salud.gob.do', password: PASSWORD, cedula: '001-0000001-1' },
  coordinator: { usuario: process.env.TEST_COORDINATOR ?? 'coordinador@salud.gob.do', password: PASSWORD, cedula: '001-0000002-2' },
  technician: { usuario: process.env.TEST_TECHNICIAN ?? 'tecnico1@salud.gob.do', password: PASSWORD, cedula: '001-0000003-3' },
  technician2: { usuario: process.env.TEST_TECHNICIAN2 ?? 'tecnico2@salud.gob.do', password: PASSWORD, cedula: '001-0000004-4' },
  company: { usuario: process.env.TEST_COMPANY ?? 'admin@lacteosdelnorte.do', password: PASSWORD, cedula: '002-0000001-1' },
  delegate: { usuario: process.env.TEST_DELEGATE ?? 'delegado@lacteosdelnorte.do', password: PASSWORD, cedula: '002-0000002-2' },
};

/** Cached access tokens populated by loginAs / loginAll */
export const tokens = {
  admin: null,
  coordinator: null,
  technician: null,
  technician2: null,
  company: null,
  delegate: null,
};

export const refreshTokens = {
  admin: null,
  coordinator: null,
  technician: null,
  technician2: null,
  company: null,
  delegate: null,
};

/** Authenticated user payloads from the last successful loginAs() */
export const sessionUsers = {
  admin: null,
  coordinator: null,
  technician: null,
  technician2: null,
  company: null,
  delegate: null,
};

const DOCKER_CONTAINER = process.env.TEST_PG_CONTAINER ?? 'mi-postgres2';
const DOCKER_USER = process.env.TEST_PG_USER ?? 'miusuario';
const ALLOWED_TEST_DATABASES = ['radar_test'];
const BLOCKED_DATABASES = ['midb2', 'postgres', 'template0', 'template1'];

function resolveSqlDatabase() {
  const db = process.env.TEST_PG_DB ?? 'radar_test';
  if (BLOCKED_DATABASES.includes(db)) {
    throw new Error(
      `Refusing SQL against "${db}". Tests may only mutate disposable databases: ${ALLOWED_TEST_DATABASES.join(', ')}.`,
    );
  }
  if (!ALLOWED_TEST_DATABASES.includes(db)) {
    throw new Error(
      `Refusing SQL against "${db}". Allowed disposable test databases: ${ALLOWED_TEST_DATABASES.join(', ')}.`,
    );
  }
  return db;
}

/**
 * Make an HTTP JSON request to the API.
 * Defaults to the cached admin token unless `token` is provided explicitly
 * (including `token: null` for unauthenticated calls).
 */
export async function request(method, path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const hasExplicitToken = Object.prototype.hasOwnProperty.call(options, 'token');
  const token = hasExplicitToken ? options.token : tokens.admin;
  if (!hasExplicitToken && !token) {
    throw new Error(
      `request(${method} ${path}) used the default admin token, but tokens.admin is null. `
      + 'Login failed or 2FA leaked onto a seeded account. Run `node scripts/reset-test-state.mjs`.',
    );
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    redirect: options.redirect ?? 'follow',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  return { status: res.status, data, headers: res.headers };
}

/**
 * Multipart request (file uploads). Do not set Content-Type; fetch adds the boundary.
 */
export async function upload(method, path, options = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(options.fields ?? {})) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  if (options.file !== undefined) {
    const mime = options.mimeType ?? 'application/octet-stream';
    const blob = options.file instanceof Blob ? options.file : new Blob([options.file], { type: mime });
    form.append(options.fileField ?? 'file', blob, options.filename ?? 'upload.bin');
  }

  const headers = { ...(options.headers ?? {}) };
  const hasExplicitToken = Object.prototype.hasOwnProperty.call(options, 'token');
  const token = hasExplicitToken ? options.token : tokens.admin;
  if (!hasExplicitToken && !token) {
    throw new Error(`upload(${method} ${path}) used the default admin token, but tokens.admin is null.`);
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { method, headers, body: form });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

/**
 * Login as a seeded role and cache tokens.
 * Throws if the account requires 2FA — seeded accounts must stay 2FA-free.
 */
export async function loginAs(role) {
  const body = ACCOUNTS[role];
  if (!body) throw new Error(`Unknown role: ${role}`);
  const res = await request('POST', '/auth/login', { token: null, body: { usuario: body.usuario, password: body.password } });
  if (res.status !== 200 || !res.data?.valid) {
    throw new Error(`loginAs(${role}) failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  const data = res.data.data;
  if (data.requiresTwoFactor) {
    throw new Error(
      `loginAs(${role}) received requiresTwoFactor=true. Seeded accounts must not have 2FA enabled. `
      + 'Run `node scripts/reset-test-state.mjs` and do not enable 2FA on seeded users.',
    );
  }
  if (!data.accessToken) {
    throw new Error(`loginAs(${role}) succeeded without an accessToken: ${JSON.stringify(data)}`);
  }
  tokens[role] = data.accessToken;
  refreshTokens[role] = data.refreshToken ?? null;
  sessionUsers[role] = data.user ?? null;
  return data;
}

export async function loginAll() {
  await Promise.all(Object.keys(ACCOUNTS).map((role) => loginAs(role)));
}

export function requireToken(role = 'admin') {
  const token = tokens[role];
  if (!token) {
    throw new Error(`No cached token for ${role}. Call loginAs('${role}') first.`);
  }
  return token;
}

// ─── Assertion helpers ──────────────────────────────────────────────────────

export function assertOk(res, expectedStatus = 200) {
  assert.strictEqual(
    res.status,
    expectedStatus,
    `Expected HTTP ${expectedStatus}, got ${res.status}. Body: ${JSON.stringify(res.data)}`,
  );
  assert.strictEqual(res.data?.valid, true, `Expected valid:true, got: ${JSON.stringify(res.data)}`);
  return res.data.data;
}

export function assertError(res, expectedStatus, expectedCode) {
  assert.strictEqual(
    res.status,
    expectedStatus,
    `Expected HTTP ${expectedStatus}, got ${res.status}. Body: ${JSON.stringify(res.data)}`,
  );
  assert.strictEqual(res.data?.valid, false, `Expected valid:false, got: ${JSON.stringify(res.data)}`);
  if (expectedCode) {
    assert.strictEqual(
      res.data?.error?.code,
      expectedCode,
      `Expected error code ${expectedCode}, got: ${res.data?.error?.code}. Body: ${JSON.stringify(res.data)}`,
    );
  }
  return res.data?.error;
}

export function assertUnauthorized(res) { return assertError(res, 401, 'UNAUTHORIZED'); }
export function assertForbidden(res) { return assertError(res, 403, 'FORBIDDEN'); }
export function assertNotFound(res) { return assertError(res, 404, 'NOT_FOUND'); }
export function assertValidationError(res) { return assertError(res, 400, 'VALIDATION_ERROR'); }
export function assertConflict(res) { return assertError(res, 409, 'CONFLICT'); }

export function assertPaginated(data) {
  assert.ok(Array.isArray(data.items), 'Expected data.items to be an array');
  assert.ok(typeof data.total === 'number', 'Expected data.total to be a number');
  assert.ok(typeof data.page === 'number', 'Expected data.page to be a number');
  assert.ok(typeof data.pageSize === 'number', 'Expected data.pageSize to be a number');
  assert.ok(typeof data.totalPages === 'number', 'Expected data.totalPages to be a number');
  return data;
}

export function uid(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function uniqueCedula() {
  const n = String(Date.now()).slice(-7).padStart(7, '0');
  const d = Math.floor(Math.random() * 10);
  return `099-${n}-${d}`;
}

export function uniqueEmail(prefix = 'api') {
  return `${uid(prefix)}@radar.test`;
}

/**
 * Register a public company-role user and (optionally) approve it as ADMIN.
 * Requires tokens.admin when approve=true.
 */
export async function registerUser(options = {}) {
  const email = options.email ?? uniqueEmail('user');
  const cedula = options.cedula ?? uniqueCedula();
  const password = options.password ?? PASSWORD;
  const name = options.name ?? `Test User ${uid('n')}`;
  let roleId = options.roleId;
  if (!roleId) {
    roleId = await roleIdByName('ADMIN_EMPRESA');
  }
  const res = await request('POST', '/users/register', {
    token: null,
    body: {
      person: { name, cedula, phone: options.phone ?? '809-555-0199', email },
      password,
      roleId,
    },
  });
  const data = assertOk(res, 201);
  const userId = data.userId ?? data.user?.userId;
  if (options.approve !== false) {
    const approve = await request('PATCH', `/users/${userId}/status`, {
      body: { status: 'APROBADO' },
    });
    assertOk(approve, 200);
  }
  return { userId, email, cedula, password, name, roleId, user: data };
}

export async function roleIdByName(name) {
  const res = await request('GET', '/roles');
  const data = assertOk(res, 200);
  const list = Array.isArray(data) ? data : data.items;
  const role = list.find((r) => r.name === name);
  if (!role) throw new Error(`Role ${name} not found in GET /roles`);
  return role.roleId;
}

// ─── Database helpers (Docker exec into the compose Postgres container) ─────

export function dbSql(sql) {
  const db = resolveSqlDatabase();
  try {
    return execFileSync(
      'docker',
      ['exec', DOCKER_CONTAINER, 'psql', '-U', DOCKER_USER, '-d', db, '-t', '-A', '-c', sql],
      { encoding: 'utf8', timeout: 15000 },
    ).trim();
  } catch (err) {
    throw new Error(`Database command failed (is Docker running and is ${DOCKER_CONTAINER}/${db} up?): ${err.message}`);
  }
}

export function disableAllTwoFactor() {
  dbSql('UPDATE two_factor_auth SET enabled = false WHERE enabled = true');
}

export function disableTwoFactorForUser(userId) {
  dbSql(`UPDATE two_factor_auth SET enabled = false WHERE user_id = ${Number(userId)}`);
}

export function latestPasswordResetToken() {
  const token = dbSql(
    'SELECT token FROM password_reset_token WHERE used = false ORDER BY created_at DESC LIMIT 1',
  );
  if (!token) throw new Error('No unused password_reset_token row found');
  return token;
}

export function twoFactorEnabledCount() {
  const n = dbSql('SELECT COUNT(*) FROM two_factor_auth WHERE enabled = true');
  return Number(n);
}

// ─── TOTP (RFC 6238) matching apps/backend/src/lib/auth/totp.ts ─────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP = 30;
const TOTP_DIGITS = 6;

function base32Decode(input) {
  const clean = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binCode =
    ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return (binCode % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0');
}

/** Generate a 6-digit TOTP for a base32 secret (same algorithm as the backend). */
export function generateTotp(base32Secret, atMs = Date.now()) {
  const secret = base32Decode(base32Secret);
  const counter = Math.floor(atMs / 1000 / TOTP_STEP);
  return hotp(secret, counter);
}

export function pngBytes() {
  // 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}
