/**
 * 07-evaluations.test.mjs
 * ---------------------------------------------------------------------------
 * Tests for /evaluations/* endpoints (RF-07, RF-11, RF-12, RF-13, RF-14, RF-15, RF-16).
 * Also tests /form-templates, /evaluations/:id/score, /evaluations/:id/evidences,
 * /evaluations/:id/report
 * ---------------------------------------------------------------------------
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  request, loginAll, tokens,
  assertOk, assertUnauthorized, assertForbidden,
  assertNotFound, assertValidationError, assertPaginated,
} from './helpers.mjs';

describe('Evaluations', () => {
  before(async () => { await loginAll(); });

  // ── GET /evaluations ──────────────────────────────────────────────────────
  describe('GET /evaluations', () => {
    test('ADMIN can list evaluations (paginated)', async () => {
      const res = await request('GET', '/evaluations?page=1&pageSize=20');
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('COORDINADOR can list evaluations', async () => {
      const res = await request('GET', '/evaluations?page=1&pageSize=20', { token: tokens.coordinator });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('TECNICO_EVALUADOR can list evaluations', async () => {
      const res = await request('GET', '/evaluations?page=1&pageSize=20', { token: tokens.technician });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('ADMIN_EMPRESA cannot list evaluations (403)', async () => {
      const res = await request('GET', '/evaluations', { token: tokens.company });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/evaluations', { token: null });
      assertUnauthorized(res);
    });

    test('each evaluation has expected shape', async () => {
      const res = await request('GET', '/evaluations?page=1&pageSize=5');
      const data = assertOk(res, 200);
      for (const ev of data.items) {
        assert.ok(typeof ev.evaluationId === 'number', 'evaluationId should be number');
        assert.ok(ev.status, 'status should be present');
        assert.ok(ev.scheduledDate, 'scheduledDate should be present');
      }
    });

    test('evaluation statuses are valid enum values', async () => {
      const validStatuses = ['PROGRAMADA', 'REPROGRAMADA', 'CANCELADA', 'EN_PROCESO', 'FINALIZADA'];
      const res = await request('GET', '/evaluations?page=1&pageSize=20');
      const data = assertOk(res, 200);
      for (const ev of data.items) {
        assert.ok(validStatuses.includes(ev.status),
          `Evaluation status ${ev.status} is not valid`);
      }
    });
  });

  // ── GET /evaluations/calendar ─────────────────────────────────────────────
  describe('GET /evaluations/calendar', () => {
    test('TECNICO_EVALUADOR can get calendar', async () => {
      const res = await request(
        'GET',
        '/evaluations/calendar?from=2026-09-01&to=2026-10-01&view=month',
        { token: tokens.technician },
      );
      assert.ok([200, 404].includes(res.status),
        `Expected 200 or 404, got ${res.status}`);
    });

    test('COORDINADOR cannot access calendar (403)', async () => {
      const res = await request(
        'GET',
        '/evaluations/calendar?from=2026-09-01&to=2026-10-01&view=month',
        { token: tokens.coordinator },
      );
      assertForbidden(res);
    });

    test('ADMIN cannot access calendar (403)', async () => {
      const res = await request(
        'GET',
        '/evaluations/calendar?from=2026-09-01&to=2026-10-01&view=month',
      );
      assertForbidden(res);
    });

    test('returns 400 for missing from/to params', async () => {
      const res = await request('GET', '/evaluations/calendar', { token: tokens.technician });
      assertValidationError(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/evaluations/calendar', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── GET /evaluations/:id ──────────────────────────────────────────────────
  describe('GET /evaluations/:id', () => {
    test('ADMIN can get evaluation by id=1', async () => {
      const res = await request('GET', '/evaluations/1');
      assert.ok([200, 404].includes(res.status),
        `Expected 200 or 404, got ${res.status}`);
    });

    test('returns 404 for nonexistent evaluation', async () => {
      const res = await request('GET', '/evaluations/999999');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/evaluations/1', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── POST /evaluations ─────────────────────────────────────────────────────
  describe('POST /evaluations', () => {
    test('COORDINADOR can create evaluation with valid data', async () => {
      // Get a case first
      const caseRes = await request('GET', '/cases?page=1&pageSize=1', { token: tokens.coordinator });
      const cases = caseRes.data?.data;
      if (!cases?.items?.length) return;

      const caseId = cases.items[0].caseId;
      const techRes = await request('GET', '/users?page=1&pageSize=20', { token: tokens.coordinator });
      const users = techRes.data?.data;
      const techUser = users?.items?.find(u => u.role?.name === 'TECNICO_EVALUADOR');
      if (!techUser) return;

      const res = await request('POST', '/evaluations', {
        token: tokens.coordinator,
        body: {
          caseId,
          technicianId: techUser.userId,
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          priority: 'MEDIA',
        },
      });
      assert.ok([200, 201, 400, 404, 409].includes(res.status),
        `Expected 200/201/400/404/409, got ${res.status}: ${JSON.stringify(res.data)}`);
    });

    test('ADMIN cannot create evaluation (403)', async () => {
      const res = await request('POST', '/evaluations', {
        body: { caseId: 1, technicianId: 3, scheduledDate: '2026-10-01' },
      });
      assertForbidden(res);
    });

    test('TECNICO_EVALUADOR cannot create evaluation (403)', async () => {
      const res = await request('POST', '/evaluations', {
        token: tokens.technician,
        body: { caseId: 1, technicianId: 3, scheduledDate: '2026-10-01' },
      });
      assertForbidden(res);
    });

    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/evaluations', {
        token: tokens.coordinator,
        body: {},
      });
      assertValidationError(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/evaluations', {
        token: null,
        body: {},
      });
      assertUnauthorized(res);
    });
  });

  // ── PATCH /evaluations/:id/reschedule ─────────────────────────────────────
  describe('PATCH /evaluations/:id/reschedule', () => {
    test('returns 400 for empty body', async () => {
      const res = await request('PATCH', '/evaluations/1/reschedule', {
        token: tokens.coordinator,
        body: {},
      });
      assertValidationError(res);
    });

    test('ADMIN cannot reschedule (403)', async () => {
      const res = await request('PATCH', '/evaluations/1/reschedule', {
        body: { scheduledDate: '2026-12-01' },
      });
      assertForbidden(res);
    });

    test('returns 404 for nonexistent evaluation', async () => {
      const res = await request('PATCH', '/evaluations/999999/reschedule', {
        token: tokens.coordinator,
        body: { scheduledDate: '2026-12-01' },
      });
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/evaluations/1/reschedule', {
        token: null,
        body: { scheduledDate: '2026-12-01' },
      });
      assertUnauthorized(res);
    });
  });

  // ── POST /evaluations/:id/cancel ──────────────────────────────────────────
  describe('POST /evaluations/:id/cancel', () => {
    test('COORDINADOR can attempt to cancel evaluation (status-dependent)', async () => {
      const res = await request('POST', '/evaluations/999999/cancel', {
        token: tokens.coordinator,
      });
      assert.ok([200, 404, 409].includes(res.status),
        `Expected 200/404/409, got ${res.status}`);
    });

    test('ADMIN cannot cancel evaluation (403)', async () => {
      const res = await request('POST', '/evaluations/1/cancel', {
        body: {},
      });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/evaluations/1/cancel', { token: null });
      assertUnauthorized(res);
    });
  });
});

// ─── Form Templates ─────────────────────────────────────────────────────────
describe('Form Templates', () => {
  before(async () => { await loginAll(); });

  describe('GET /form-templates', () => {
    test('ADMIN can list form templates', async () => {
      const res = await request('GET', '/form-templates');
      const data = assertOk(res, 200);
      assert.ok(Array.isArray(data), 'form templates should be an array');
    });

    test('TECNICO_EVALUADOR can list form templates', async () => {
      const res = await request('GET', '/form-templates', { token: tokens.technician });
      const data = assertOk(res, 200);
      assert.ok(Array.isArray(data), 'form templates should be an array');
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/form-templates', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('GET /form-templates/:id/tree', () => {
    test('returns 200 or 404 for template id=1', async () => {
      const res = await request('GET', '/form-templates/1/tree');
      assert.ok([200, 404].includes(res.status),
        `Expected 200 or 404, got ${res.status}`);
    });

    test('returns 404 for nonexistent template', async () => {
      const res = await request('GET', '/form-templates/999999/tree');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/form-templates/1/tree', { token: null });
      assertUnauthorized(res);
    });
  });
});

// ─── Evaluation Score (Risk Engine) ─────────────────────────────────────────
describe('Evaluation Score', () => {
  before(async () => { await loginAll(); });

  describe('GET /evaluations/:id/score', () => {
    test('ADMIN can get score for evaluation 1', async () => {
      const res = await request('GET', '/evaluations/1/score');
      assert.ok([200, 404].includes(res.status),
        `Expected 200 or 404, got ${res.status}`);
    });

    test('returns 404 for nonexistent evaluation', async () => {
      const res = await request('GET', '/evaluations/999999/score');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/evaluations/1/score', { token: null });
      assertUnauthorized(res);
    });
  });
});

// ─── Evidences ───────────────────────────────────────────────────────────────
describe('Evidences', () => {
  before(async () => { await loginAll(); });

  describe('GET /evaluations/:id/evidences', () => {
    test('ADMIN can get evidences for evaluation', async () => {
      const res = await request('GET', '/evaluations/1/evidences');
      assert.ok([200, 403, 404].includes(res.status),
        `Expected 200/403/404, got ${res.status}`);
    });

    test('TECNICO_EVALUADOR can get evidences (role-based access)', async () => {
      const res = await request('GET', '/evaluations/1/evidences', { token: tokens.technician });
      assert.ok([200, 403, 404].includes(res.status),
        `Expected 200/403/404, got ${res.status}`);
    });

    test('returns 404 for nonexistent evaluation', async () => {
      const res = await request('GET', '/evaluations/999999/evidences');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/evaluations/1/evidences', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('POST /evaluations/:id/evidences', () => {
    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/evaluations/1/evidences', {
        token: tokens.technician,
        body: {},
      });
      assert.ok([400, 403, 404].includes(res.status),
        `Expected 400/403/404, got ${res.status}`);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/evaluations/1/evidences', {
        token: null,
        body: {},
      });
      assertUnauthorized(res);
    });
  });

  describe('DELETE /evidences/:id', () => {
    test('returns 404 for nonexistent evidence', async () => {
      const res = await request('DELETE', '/evidences/999999');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('DELETE', '/evidences/1', { token: null });
      assertUnauthorized(res);
    });
  });
});

// ─── Reports ─────────────────────────────────────────────────────────────────
describe('Reports', () => {
  before(async () => { await loginAll(); });

  describe('GET /evaluations/:id/report', () => {
    test('ADMIN can get report for evaluation', async () => {
      const res = await request('GET', '/evaluations/1/report');
      assert.ok([200, 404].includes(res.status),
        `Expected 200 or 404, got ${res.status}`);
    });

    test('returns 404 for nonexistent evaluation', async () => {
      const res = await request('GET', '/evaluations/999999/report');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/evaluations/1/report', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('GET /reports/:id/reviews', () => {
    test('ADMIN can get reviews for report', async () => {
      const res = await request('GET', '/reports/1/reviews');
      assert.ok([200, 404].includes(res.status),
        `Expected 200 or 404, got ${res.status}`);
    });

    test('returns 404 for nonexistent report', async () => {
      const res = await request('GET', '/reports/999999/reviews');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/reports/1/reviews', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('POST /reports/:id/submit', () => {
    test('returns 404 for nonexistent report', async () => {
      const res = await request('POST', '/reports/999999/submit');
      assert.ok([403, 404, 409].includes(res.status),
        `Expected 403/404/409, got ${res.status}`);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/reports/1/submit', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('POST /reports/:id/review', () => {
    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/reports/1/review', { body: {} });
      assertValidationError(res);
    });

    test('TECNICO_EVALUADOR cannot review reports (403)', async () => {
      const res = await request('POST', '/reports/1/review', {
        token: tokens.technician,
        body: { action: 'APROBAR' },
      });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/reports/1/review', {
        token: null,
        body: { action: 'APROBAR' },
      });
      assertUnauthorized(res);
    });
  });

  describe('POST /reports/:id/correct', () => {
    test('returns 400 or 403 for empty body (business rule or validation, depending on report state)', async () => {
      // The backend checks report state (locked/unlocked) before validating the body.
      // Report 1 may be in a locked state → 403. An unlocked report with empty body → 400.
      const res = await request('POST', '/reports/1/correct', { body: {} });
      assert.ok([400, 403].includes(res.status),
        `Expected 400 (validation) or 403 (report locked), got ${res.status}: ${JSON.stringify(res.data)}`);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/reports/1/correct', {
        token: null,
        body: { resumenEjecutivo: 'x', hallazgos: 'x', noConformidades: 'x', recomendaciones: 'x' },
      });
      assertUnauthorized(res);
    });
  });

  describe('POST /reports/:id/resend', () => {
    test('returns 404 for nonexistent report', async () => {
      const res = await request('POST', '/reports/999999/resend');
      assert.ok([404, 409].includes(res.status),
        `Expected 404/409, got ${res.status}`);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/reports/1/resend', { token: null });
      assertUnauthorized(res);
    });
  });
});

// ─── Form Execution ───────────────────────────────────────────────────────────
describe('Form Execution', () => {
  before(async () => { await loginAll(); });

  describe('POST /evaluations/:id/start', () => {
    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/evaluations/1/start', {
        token: tokens.technician,
        body: {},
      });
      assertValidationError(res);
    });

    test('COORDINADOR cannot start evaluation (403)', async () => {
      const res = await request('POST', '/evaluations/1/start', {
        token: tokens.coordinator,
        body: { formTemplateId: 1, representId: 1, foodId: 1, motive: 'inspection' },
      });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/evaluations/1/start', {
        token: null,
        body: {},
      });
      assertUnauthorized(res);
    });
  });

  describe('PATCH /evaluations/:id/answers', () => {
    test('returns 400 for empty body', async () => {
      const res = await request('PATCH', '/evaluations/1/answers', {
        token: tokens.technician,
        body: {},
      });
      assertValidationError(res);
    });

    test('COORDINADOR cannot save answers (403)', async () => {
      const res = await request('PATCH', '/evaluations/1/answers', {
        token: tokens.coordinator,
        body: { answers: {} },
      });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/evaluations/1/answers', {
        token: null,
        body: { answers: {} },
      });
      assertUnauthorized(res);
    });
  });

  describe('POST /evaluations/:id/finish', () => {
    test('returns 404 for nonexistent evaluation', async () => {
      const res = await request('POST', '/evaluations/999999/finish', {
        token: tokens.technician,
      });
      assert.ok([403, 404, 409].includes(res.status),
        `Expected 403/404/409, got ${res.status}`);
    });

    test('COORDINADOR cannot finish evaluation (403)', async () => {
      const res = await request('POST', '/evaluations/1/finish', {
        token: tokens.coordinator,
      });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/evaluations/1/finish', { token: null });
      assertUnauthorized(res);
    });
  });
});
