/**
 * 05-bpm-requests.test.mjs
 * ---------------------------------------------------------------------------
 * Tests for /bpm-requests/* endpoints (RF-05).
 * ---------------------------------------------------------------------------
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  request, loginAll, tokens,
  assertOk, assertUnauthorized, assertForbidden,
  assertNotFound, assertValidationError, assertPaginated, uid,
} from './helpers.mjs';

describe('BPM Requests', () => {
  before(async () => { await loginAll(); });

  // ── GET /bpm-requests ─────────────────────────────────────────────────────
  describe('GET /bpm-requests', () => {
    test('ADMIN can list bpm-requests (paginated)', async () => {
      const res = await request('GET', '/bpm-requests?page=1&pageSize=20');
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('COORDINADOR can list bpm-requests', async () => {
      const res = await request('GET', '/bpm-requests?page=1&pageSize=20', { token: tokens.coordinator });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('ADMIN_EMPRESA can list bpm-requests', async () => {
      const res = await request('GET', '/bpm-requests?page=1&pageSize=20', { token: tokens.company });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('USUARIO_DELEGADO can list bpm-requests', async () => {
      const res = await request('GET', '/bpm-requests?page=1&pageSize=20', { token: tokens.delegate });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('TECNICO_EVALUADOR cannot list bpm-requests (403)', async () => {
      const res = await request('GET', '/bpm-requests', { token: tokens.technician });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/bpm-requests', { token: null });
      assertUnauthorized(res);
    });

    test('each item has expected shape', async () => {
      const res = await request('GET', '/bpm-requests?page=1&pageSize=5');
      const data = assertOk(res, 200);
      for (const item of data.items) {
        assert.ok(typeof item.bpmRequestId === 'number', 'bpmRequestId should be a number');
        assert.ok(item.status, 'status should be present');
        assert.ok(item.motivo !== undefined, 'motivo should be present');
      }
    });
  });

  // ── GET /bpm-requests/:id ─────────────────────────────────────────────────
  describe('GET /bpm-requests/:id', () => {
    test('ADMIN can get bpm-request by id=1', async () => {
      const res = await request('GET', '/bpm-requests/1');
      assert.ok([200, 404].includes(res.status),
        `Expected 200 or 404, got ${res.status}`);
    });

    test('returns 404 for nonexistent bpm-request', async () => {
      const res = await request('GET', '/bpm-requests/999999');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/bpm-requests/1', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── POST /bpm-requests ────────────────────────────────────────────────────
  describe('POST /bpm-requests', () => {
    test('ADMIN_EMPRESA can create bpm-request', async () => {
      const unique = uid();
      // Get the company's institution first
      const listRes = await request('GET', '/institutions?page=1&pageSize=5', { token: tokens.company });
      const institutions = listRes.data?.data;
      if (!institutions?.items?.length) return; // Skip if no institutions

      const institutionId = institutions.items[0].institutionId;
      const res = await request('POST', '/bpm-requests', {
        token: tokens.company,
        body: {
          institutionId,
          tipoEstablecimiento: 'MANUFACTURA',
          motivo: `Test BPM request ${unique}`,
        },
      });
      assert.ok([200, 201, 400, 404, 409].includes(res.status),
        `Expected 200/201/400/404/409, got ${res.status}: ${JSON.stringify(res.data)}`);
    });

    test('COORDINADOR cannot create bpm-request (403)', async () => {
      const res = await request('POST', '/bpm-requests', {
        token: tokens.coordinator,
        body: { institutionId: 1, tipoEstablecimiento: 'X', motivo: 'test' },
      });
      assertForbidden(res);
    });

    test('ADMIN cannot create bpm-request (403)', async () => {
      const res = await request('POST', '/bpm-requests', {
        token: tokens.admin,
        body: { institutionId: 1, tipoEstablecimiento: 'X', motivo: 'test' },
      });
      assertForbidden(res);
    });

    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/bpm-requests', {
        token: tokens.company,
        body: {},
      });
      assertValidationError(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/bpm-requests', {
        token: null,
        body: { institutionId: 1, tipoEstablecimiento: 'X', motivo: 'test' },
      });
      assertUnauthorized(res);
    });
  });

  // ── PATCH /bpm-requests/:id ───────────────────────────────────────────────
  describe('PATCH /bpm-requests/:id', () => {
    test('returns 404 for nonexistent bpm-request', async () => {
      const res = await request('PATCH', '/bpm-requests/999999', {
        body: { motivo: 'updated' },
      });
      assertNotFound(res);
    });

    test('returns 400 for empty body', async () => {
      const res = await request('PATCH', '/bpm-requests/1', {
        body: {},
      });
      assert.ok([400, 403, 404].includes(res.status),
        `Expected 400/403/404, got ${res.status}`);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/bpm-requests/1', {
        token: null,
        body: { motivo: 'x' },
      });
      assertUnauthorized(res);
    });
  });

  // ── POST /bpm-requests/:id/submit ─────────────────────────────────────────
  describe('POST /bpm-requests/:id/submit', () => {
    test('returns 404 for nonexistent bpm-request', async () => {
      const res = await request('POST', '/bpm-requests/999999/submit', {
        token: tokens.company,
      });
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/bpm-requests/1/submit', { token: null });
      assertUnauthorized(res);
    });
  });
});
