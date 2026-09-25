/**
 * 04-institutions.test.mjs
 * ---------------------------------------------------------------------------
 * Tests for /institutions/* and /representatives/* endpoints (RF-03).
 * ---------------------------------------------------------------------------
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  request, loginAll, tokens,
  assertOk, assertError, assertUnauthorized, assertForbidden,
  assertNotFound, assertValidationError, assertPaginated, uid,
} from './helpers.mjs';

describe('Institutions', () => {
  before(async () => { await loginAll(); });

  // ── GET /institutions ─────────────────────────────────────────────────────
  describe('GET /institutions', () => {
    test('ADMIN can list institutions (paginated)', async () => {
      const res = await request('GET', '/institutions?page=1&pageSize=20');
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('COORDINADOR can list institutions', async () => {
      const res = await request('GET', '/institutions?page=1&pageSize=20', { token: tokens.coordinator });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('ADMIN_EMPRESA can list institutions', async () => {
      const res = await request('GET', '/institutions?page=1&pageSize=20', { token: tokens.company });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('USUARIO_DELEGADO can list institutions', async () => {
      const res = await request('GET', '/institutions?page=1&pageSize=20', { token: tokens.delegate });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('TECNICO_EVALUADOR cannot list institutions (403)', async () => {
      const res = await request('GET', '/institutions', { token: tokens.technician });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/institutions', { token: null });
      assertUnauthorized(res);
    });

    test('returns well-shaped institution items', async () => {
      const res = await request('GET', '/institutions?page=1&pageSize=5');
      const data = assertOk(res, 200);
      for (const inst of data.items) {
        assert.ok(typeof inst.institutionId === 'number', 'institutionId should be a number');
        assert.ok(inst.name, 'institution.name should be present');
        assert.ok(inst.email, 'institution.email should be present');
        assert.ok(inst.rnc, 'institution.rnc should be present');
      }
    });
  });

  // ── GET /institutions/:id ─────────────────────────────────────────────────
  describe('GET /institutions/:id', () => {
    test('ADMIN can get institution by id=1', async () => {
      const res = await request('GET', '/institutions/1');
      const data = assertOk(res, 200);
      assert.ok(data.institutionId, 'Should have institutionId');
    });

    test('returns 404 for nonexistent institution', async () => {
      const res = await request('GET', '/institutions/999999');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/institutions/1', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── GET /institutions/:id/history ─────────────────────────────────────────
  describe('GET /institutions/:id/history', () => {
    test('ADMIN can get institution history', async () => {
      const res = await request('GET', '/institutions/1/history');
      assertOk(res, 200);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/institutions/1/history', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── GET /institutions/:id/evaluations ─────────────────────────────────────
  describe('GET /institutions/:id/evaluations', () => {
    test('ADMIN can get institution evaluations', async () => {
      const res = await request('GET', '/institutions/1/evaluations?page=1&pageSize=20');
      assertOk(res, 200);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/institutions/1/evaluations', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── POST /institutions ────────────────────────────────────────────────────
  describe('POST /institutions', () => {
    test('ADMIN_EMPRESA can create institution', async () => {
      const munis = await request('GET', '/catalogs/municipalities', { token: tokens.company });
      const list = assertOk(munis, 200);
      assert.ok(Array.isArray(list) && list.length > 0, 'municipalities catalog must be seeded');
      const unique = uid();
      const res = await request('POST', '/institutions', {
        token: tokens.company,
        body: {
          name: `Test Institution ${unique}`,
          streetName: 'Calle Prueba 123',
          phoneNumber: '809-555-0001',
          email: `inst-${unique}@example.com`,
          rnc: `9${Date.now().toString().slice(-8)}`,
          nombreComercial: `Test Business ${unique}`,
          actividadEconomica: 'Manufactura',
          municipalityId: list[0].municipalityId,
        },
      });
      assertOk(res, 201);
    });

    test('returns 400 when municipalityId is missing', async () => {
      const res = await request('POST', '/institutions', {
        token: tokens.company,
        body: {
          name: 'Incomplete',
          streetName: 'Y',
          phoneNumber: '809-555-0001',
          email: 'incomplete@example.com',
          rnc: '988877766',
        },
      });
      assertValidationError(res);
    });

    test('COORDINADOR cannot create institution (403)', async () => {
      const res = await request('POST', '/institutions', {
        token: tokens.coordinator,
        body: { name: 'X', streetName: 'Y', phoneNumber: '0', email: 'x@x.com', rnc: '1' },
      });
      assertForbidden(res);
    });

    test('ADMIN cannot create institution (403)', async () => {
      const res = await request('POST', '/institutions', {
        token: tokens.admin,
        body: { name: 'X', streetName: 'Y', phoneNumber: '0', email: 'x@x.com', rnc: '1' },
      });
      assertForbidden(res);
    });

    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/institutions', {
        token: tokens.company,
        body: {},
      });
      assertValidationError(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/institutions', {
        token: null,
        body: { name: 'X' },
      });
      assertUnauthorized(res);
    });
  });

  // ── PATCH /institutions/:id ───────────────────────────────────────────────
  describe('PATCH /institutions/:id', () => {
    test('returns 404 for nonexistent institution', async () => {
      const res = await request('PATCH', '/institutions/999999', {
        body: { name: 'Updated Name' },
      });
      assertNotFound(res);
    });

    test('TECNICO_EVALUADOR cannot update institution (403)', async () => {
      const res = await request('PATCH', '/institutions/1', {
        token: tokens.technician,
        body: { name: 'Test' },
      });
      assertForbidden(res);
    });

    test('returns 404 for empty body on a missing institution', async () => {
      const res = await request('PATCH', '/institutions/999999', {
        body: {},
      });
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/institutions/1', {
        token: null,
        body: { name: 'X' },
      });
      assertUnauthorized(res);
    });
  });

  // ── Representatives ───────────────────────────────────────────────────────
  describe('POST /institutions/:id/representatives', () => {
    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/institutions/1/representatives', {
        token: tokens.company,
        body: {},
      });
      assertValidationError(res);
    });

    test('COORDINADOR cannot add representative (403)', async () => {
      const res = await request('POST', '/institutions/1/representatives', {
        token: tokens.coordinator,
        body: { personId: 1, type: 'LEGAL' },
      });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/institutions/1/representatives', {
        token: null,
        body: {},
      });
      assertUnauthorized(res);
    });
  });

  describe('PATCH /representatives/:id', () => {
    test('returns 404 for nonexistent representative', async () => {
      const res = await request('PATCH', '/representatives/999999', {
        token: tokens.company,
        body: { type: 'LEGAL' },
      });
      assertNotFound(res);
    });

    test('COORDINADOR cannot update representative (403)', async () => {
      const res = await request('PATCH', '/representatives/999999', {
        token: tokens.coordinator,
        body: { type: 'LEGAL' },
      });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/representatives/1', {
        token: null,
        body: { type: 'LEGAL' },
      });
      assertUnauthorized(res);
    });
  });

  describe('DELETE /representatives/:id', () => {
    test('returns 404 for nonexistent representative', async () => {
      const res = await request('DELETE', '/representatives/999999', {
        token: tokens.company,
      });
      assertNotFound(res);
    });

    test('COORDINADOR cannot delete representative (403)', async () => {
      const res = await request('DELETE', '/representatives/1', {
        token: tokens.coordinator,
      });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('DELETE', '/representatives/1', { token: null });
      assertUnauthorized(res);
    });
  });
});
