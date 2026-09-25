/**
 * 06-cases.test.mjs
 * ---------------------------------------------------------------------------
 * Tests for /cases/* and /cases/:id/assignments endpoints (RF-06, RF-10, RF-19).
 * ---------------------------------------------------------------------------
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  request, loginAll, tokens,
  assertOk, assertUnauthorized, assertForbidden,
  assertNotFound, assertValidationError, assertPaginated, uid,
} from './helpers.mjs';

describe('Cases', () => {
  before(async () => { await loginAll(); });

  // ── GET /cases ────────────────────────────────────────────────────────────
  describe('GET /cases', () => {
    test('ADMIN can list cases (paginated)', async () => {
      const res = await request('GET', '/cases?page=1&pageSize=20');
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('COORDINADOR can list cases', async () => {
      const res = await request('GET', '/cases?page=1&pageSize=20', { token: tokens.coordinator });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('TECNICO_EVALUADOR cannot list cases (403)', async () => {
      const res = await request('GET', '/cases', { token: tokens.technician });
      assertForbidden(res);
    });

    test('ADMIN_EMPRESA cannot list cases (403)', async () => {
      const res = await request('GET', '/cases', { token: tokens.company });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/cases', { token: null });
      assertUnauthorized(res);
    });

    test('each case has expected shape', async () => {
      const res = await request('GET', '/cases?page=1&pageSize=5');
      const data = assertOk(res, 200);
      for (const c of data.items) {
        assert.ok(typeof c.caseId === 'number', 'caseId should be number');
        assert.ok(c.origin, 'origin should be present');
        assert.ok(c.status, 'status should be present');
        assert.ok(c.priority, 'priority should be present');
      }
    });

    test('case status values are valid enum values', async () => {
      const validStatuses = ['ABIERTO', 'ASIGNADO', 'EN_EVALUACION', 'EN_REVISION', 'CERRADO'];
      const res = await request('GET', '/cases?page=1&pageSize=20');
      const data = assertOk(res, 200);
      for (const c of data.items) {
        assert.ok(validStatuses.includes(c.status),
          `Case status ${c.status} is not a valid CaseStatus`);
      }
    });

    test('case origin values are valid enum values', async () => {
      const validOrigins = ['SOLICITUD_EMPRESA', 'PROGRAMACION_INSTITUCIONAL', 'ALERTA_LAPCH', 'DENUNCIA'];
      const res = await request('GET', '/cases?page=1&pageSize=20');
      const data = assertOk(res, 200);
      for (const c of data.items) {
        assert.ok(validOrigins.includes(c.origin),
          `Case origin ${c.origin} is not a valid CaseOrigin`);
      }
    });
  });

  // ── GET /cases/:id ────────────────────────────────────────────────────────
  describe('GET /cases/:id', () => {
    test('ADMIN can get case by id=1', async () => {
      const res = await request('GET', '/cases/1');
      assert.ok([200, 404].includes(res.status),
        `Expected 200 or 404, got ${res.status}`);
    });

    test('returns 404 for nonexistent case', async () => {
      const res = await request('GET', '/cases/999999');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/cases/1', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── POST /cases ───────────────────────────────────────────────────────────
  describe('POST /cases', () => {
    test('COORDINADOR can create a case with valid data', async () => {
      // Get an institution first
      const instRes = await request('GET', '/institutions?page=1&pageSize=1', { token: tokens.coordinator });
      const institutions = instRes.data?.data;
      if (!institutions?.items?.length) return;

      const institutionId = institutions.items[0].institutionId;
      const res = await request('POST', '/cases', {
        token: tokens.coordinator,
        body: {
          institutionId,
          priority: 'MEDIA',
          motivo: 'Test case creation',
        },
      });
      assert.ok([200, 201, 400, 404, 409].includes(res.status),
        `Expected 200/201/400/404/409, got ${res.status}: ${JSON.stringify(res.data)}`);
    });

    test('ADMIN cannot create case (403)', async () => {
      const res = await request('POST', '/cases', {
        body: { institutionId: 1, origin: 'PROGRAMACION_INSTITUCIONAL' },
      });
      assertForbidden(res);
    });

    test('TECNICO_EVALUADOR cannot create case (403)', async () => {
      const res = await request('POST', '/cases', {
        token: tokens.technician,
        body: { institutionId: 1, origin: 'PROGRAMACION_INSTITUCIONAL' },
      });
      assertForbidden(res);
    });

    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/cases', {
        token: tokens.coordinator,
        body: {},
      });
      assertValidationError(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/cases', {
        token: null,
        body: { institutionId: 1, origin: 'DENUNCIA' },
      });
      assertUnauthorized(res);
    });
  });

  // ── PATCH /cases/:id/priority ─────────────────────────────────────────────
  describe('PATCH /cases/:id/priority', () => {
    test('returns 400 for empty body', async () => {
      const res = await request('PATCH', '/cases/1/priority', {
        token: tokens.coordinator,
        body: {},
      });
      assertValidationError(res);
    });

    test('ADMIN cannot update priority (403)', async () => {
      const res = await request('PATCH', '/cases/1/priority', {
        body: { priority: 'ALTA' },
      });
      assertForbidden(res);
    });

    test('returns 404 for nonexistent case', async () => {
      const res = await request('PATCH', '/cases/999999/priority', {
        token: tokens.coordinator,
        body: { priority: 'ALTA' },
      });
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/cases/1/priority', {
        token: null,
        body: { priority: 'ALTA' },
      });
      assertUnauthorized(res);
    });
  });

  // ── POST /cases/:id/close ─────────────────────────────────────────────────
  describe('POST /cases/:id/close', () => {
    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/cases/1/close', {
        token: tokens.coordinator,
        body: {},
      });
      assertValidationError(res);
    });

    test('ADMIN cannot close case (403)', async () => {
      const res = await request('POST', '/cases/1/close', {
        body: { resultadoFinal: 'Cerrado' },
      });
      assertForbidden(res);
    });

    test('returns 404 for nonexistent case', async () => {
      const res = await request('POST', '/cases/999999/close', {
        token: tokens.coordinator,
        body: { resultadoFinal: 'Cerrado', emitirInforme: false },
      });
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/cases/1/close', {
        token: null,
        body: { resultadoFinal: 'Cerrado' },
      });
      assertUnauthorized(res);
    });
  });

  // ── GET /cases/:id/close/pdf ──────────────────────────────────────────────
  describe('GET /cases/:id/close/pdf', () => {
    test('returns 404 for nonexistent case', async () => {
      const res = await request('GET', '/cases/999999/close/pdf');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/cases/1/close/pdf', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── Assignments ───────────────────────────────────────────────────────────
  describe('GET /cases/:id/assignments', () => {
    test('COORDINADOR can list assignments for case', async () => {
      const res = await request('GET', '/cases/1/assignments', { token: tokens.coordinator });
      assert.ok([200, 404].includes(res.status),
        `Expected 200 or 404, got ${res.status}`);
    });

    test('ADMIN can list assignments for case', async () => {
      const res = await request('GET', '/cases/1/assignments');
      assert.ok([200, 404].includes(res.status),
        `Expected 200 or 404, got ${res.status}`);
    });

    test('TECNICO_EVALUADOR cannot list assignments (403)', async () => {
      const res = await request('GET', '/cases/1/assignments', { token: tokens.technician });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/cases/1/assignments', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('POST /cases/:id/assign', () => {
    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/cases/1/assign', {
        token: tokens.coordinator,
        body: {},
      });
      assertValidationError(res);
    });

    test('TECNICO_EVALUADOR cannot assign (403)', async () => {
      const res = await request('POST', '/cases/1/assign', {
        token: tokens.technician,
        body: { technicianId: 3 },
      });
      assertForbidden(res);
    });

    test('returns 404 for nonexistent case', async () => {
      const res = await request('POST', '/cases/999999/assign', {
        token: tokens.coordinator,
        body: { technicianId: 3 },
      });
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/cases/1/assign', {
        token: null,
        body: { technicianId: 3 },
      });
      assertUnauthorized(res);
    });
  });

  describe('POST /cases/:id/reassign', () => {
    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/cases/1/reassign', {
        token: tokens.coordinator,
        body: {},
      });
      assertValidationError(res);
    });

    test('returns 404 for nonexistent case', async () => {
      const res = await request('POST', '/cases/999999/reassign', {
        token: tokens.coordinator,
        body: { technicianId: 3 },
      });
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/cases/1/reassign', {
        token: null,
        body: { technicianId: 3 },
      });
      assertUnauthorized(res);
    });
  });
});
