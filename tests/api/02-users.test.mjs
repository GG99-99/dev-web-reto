/**
 * 02-users.test.mjs
 * ---------------------------------------------------------------------------
 * Tests for /users/* endpoints (RF-02).
 * POST /users/register (public), GET/PATCH/DELETE /users/:id, etc.
 * ---------------------------------------------------------------------------
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  request, loginAll, tokens, sessionUsers,
  assertOk, assertError, assertUnauthorized, assertForbidden,
  assertNotFound, assertValidationError, assertPaginated, uid,
} from './helpers.mjs';

describe('Users', () => {
  before(async () => {
    await loginAll();
  });

  // ── GET /users ────────────────────────────────────────────────────────────
  describe('GET /users', () => {
    test('ADMIN can list users (paginated)', async () => {
      const res = await request('GET', '/users?page=1&pageSize=20');
      const data = assertOk(res, 200);
      assertPaginated(data);
      assert.ok(data.items.length > 0, 'Should have at least one user');
    });

    test('COORDINADOR can list users', async () => {
      const res = await request('GET', '/users?page=1&pageSize=20', { token: tokens.coordinator });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('TECNICO_EVALUADOR cannot list users (403)', async () => {
      const res = await request('GET', '/users', { token: tokens.technician });
      assertForbidden(res);
    });

    test('ADMIN_EMPRESA cannot list users (403)', async () => {
      const res = await request('GET', '/users', { token: tokens.company });
      assertForbidden(res);
    });

    test('unauthenticated user cannot list users (401)', async () => {
      const res = await request('GET', '/users', { token: null });
      assertUnauthorized(res);
    });

    test('pagination with pageSize=5 returns at most 5 items', async () => {
      const res = await request('GET', '/users?page=1&pageSize=5');
      const data = assertOk(res, 200);
      assert.ok(data.items.length <= 5, 'Should return at most 5 items');
    });

    test('each user has expected shape', async () => {
      const res = await request('GET', '/users?page=1&pageSize=5');
      const data = assertOk(res, 200);
      for (const user of data.items) {
        assert.ok(typeof user.userId === 'number', 'user.userId should be a number');
        assert.ok(user.person, 'user.person should be present');
        assert.ok(user.person.name, 'user.person.name should be present');
        assert.ok(user.person.email, 'user.person.email should be present');
      }
    });
  });

  // ── GET /users/:id ────────────────────────────────────────────────────────
  describe('GET /users/:id', () => {
    test('ADMIN can get user by id=1', async () => {
      const res = await request('GET', '/users/1');
      const data = assertOk(res, 200);
      assert.ok(data.userId, 'Should have userId');
    });

    test('returns 404 for nonexistent userId', async () => {
      const res = await request('GET', '/users/999999');
      assertNotFound(res);
    });

    test('unauthenticated cannot get user (401)', async () => {
      const res = await request('GET', '/users/1', { token: null });
      assertUnauthorized(res);
    });

    test('a user can read their own profile', async () => {
      const me = sessionUsers.technician.userId;
      const res = await request('GET', `/users/${me}`, { token: tokens.technician });
      const data = assertOk(res, 200);
      assert.strictEqual(data.userId, me);
    });

    test('a technician cannot read another user profile', async () => {
      const res = await request('GET', '/users/1', { token: tokens.technician });
      assertForbidden(res);
    });
  });

  // ── POST /users/register ──────────────────────────────────────────────────
  describe('POST /users/register', () => {
    test('registers a new user with valid data', async () => {
      const unique = uid();
      const res = await request('POST', '/users/register', {
        token: null,
        body: {
          person: {
            name: `Test User ${unique}`,
            email: `test-${unique}@example.com`,
            cedula: `099-${unique.slice(-7)}-9`,
            phone: '809-555-9999',
          },
          password: 'Password123!',
          roleId: 2, // ADMIN_EMPRESA
        },
      });
      const data = assertOk(res, 201);
      assert.ok(data.userId, 'registered user should have userId');
    });

    test('returns 400 for missing password', async () => {
      const res = await request('POST', '/users/register', {
        token: null,
        body: {
          person: {
            name: 'Missing Password',
            email: 'nopw@example.com',
            cedula: '099-0000000-1',
            phone: '809-555-0000',
          },
          roleId: 2,
        },
      });
      assertValidationError(res);
    });

    test('returns 400 for password shorter than 8 characters', async () => {
      const res = await request('POST', '/users/register', {
        token: null,
        body: {
          person: {
            name: 'Short Pass',
            email: 'shortpass@example.com',
            cedula: '099-0000000-2',
            phone: '809-555-0001',
          },
          password: 'short',
          roleId: 2,
        },
      });
      assertValidationError(res);
    });

    test('returns 400 for missing person.name', async () => {
      const res = await request('POST', '/users/register', {
        token: null,
        body: {
          person: {
            email: 'noname@example.com',
            cedula: '099-0000000-3',
            phone: '809-555-0002',
          },
          password: 'Password123!',
          roleId: 2,
        },
      });
      assertValidationError(res);
    });

    test('returns 400 for missing person.email', async () => {
      const res = await request('POST', '/users/register', {
        token: null,
        body: {
          person: {
            name: 'No Email User',
            cedula: '099-0000000-4',
            phone: '809-555-0003',
          },
          password: 'Password123!',
          roleId: 2,
        },
      });
      assertValidationError(res);
    });

    test('returns 409 for duplicate cedula', async () => {
      // The seeded cedula 001-0000001-1 already exists
      const res = await request('POST', '/users/register', {
        token: null,
        body: {
          person: {
            name: 'Duplicate Cedula',
            email: 'dup-cedula@example.com',
            cedula: '001-0000001-1',
            phone: '809-555-1234',
          },
          password: 'Password123!',
          roleId: 2,
        },
      });
      assertError(res, 409, 'CONFLICT');
    });
  });

  // ── PATCH /users/:id/status ───────────────────────────────────────────────
  describe('PATCH /users/:id/status', () => {
    test('returns 400 with empty body (missing status)', async () => {
      const res = await request('PATCH', '/users/1/status', { body: {} });
      assertValidationError(res);
    });

    test('non-ADMIN role gets 403', async () => {
      const res = await request('PATCH', '/users/1/status', {
        token: tokens.coordinator,
        body: { status: 'APROBADO' },
      });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/users/1/status', {
        token: null,
        body: { status: 'APROBADO' },
      });
      assertUnauthorized(res);
    });
  });

  // ── DELETE /users/:id ─────────────────────────────────────────────────────
  describe('DELETE /users/:id', () => {
    test('returns 404 for nonexistent user', async () => {
      const res = await request('DELETE', '/users/999999');
      assertNotFound(res);
    });

    test('non-ADMIN role gets 403', async () => {
      const res = await request('DELETE', '/users/1', { token: tokens.coordinator });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('DELETE', '/users/1', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── PATCH /users/:id ──────────────────────────────────────────────────────
  describe('PATCH /users/:id', () => {
    test('returns 404 for nonexistent user', async () => {
      const res = await request('PATCH', '/users/999999', { body: { name: 'X' } });
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/users/1', { token: null, body: {} });
      assertUnauthorized(res);
    });

    test('a user can update their own person name', async () => {
      const me = sessionUsers.delegate.userId;
      const res = await request('PATCH', `/users/${me}`, {
        token: tokens.delegate,
        body: { phone: '829-555-0444' },
      });
      const data = assertOk(res, 200);
      assert.ok(data);
    });
  });
});
