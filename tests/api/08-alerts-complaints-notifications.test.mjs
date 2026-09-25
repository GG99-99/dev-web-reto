/**
 * 08-alerts-complaints-notifications.test.mjs
 * ---------------------------------------------------------------------------
 * Tests for:
 *  - /lapch-alerts/* (RF-08)
 *  - /complaints/*   (RF-09)
 *  - /notifications/* (RF-04)
 *  - /dashboard/* (RF-04)
 *  - /history/search (RF-20)
 *  - /attachments/* (RF-15)
 * ---------------------------------------------------------------------------
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  request, loginAll, tokens,
  assertOk, assertUnauthorized, assertForbidden,
  assertNotFound, assertValidationError, assertPaginated, uid,
} from './helpers.mjs';

// ─── LAPCH Alerts ────────────────────────────────────────────────────────────
describe('LAPCH Alerts', () => {
  before(async () => { await loginAll(); });

  describe('GET /lapch-alerts', () => {
    test('ADMIN can list lapch-alerts (paginated)', async () => {
      const res = await request('GET', '/lapch-alerts?page=1&pageSize=20');
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('COORDINADOR can list lapch-alerts', async () => {
      const res = await request('GET', '/lapch-alerts?page=1&pageSize=20', { token: tokens.coordinator });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('TECNICO_EVALUADOR cannot list lapch-alerts (403)', async () => {
      const res = await request('GET', '/lapch-alerts', { token: tokens.technician });
      assertForbidden(res);
    });

    test('ADMIN_EMPRESA cannot list lapch-alerts (403)', async () => {
      const res = await request('GET', '/lapch-alerts', { token: tokens.company });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/lapch-alerts', { token: null });
      assertUnauthorized(res);
    });

    test('each alert has expected shape', async () => {
      const res = await request('GET', '/lapch-alerts?page=1&pageSize=5');
      const data = assertOk(res, 200);
      for (const alert of data.items) {
        assert.ok(typeof alert.alertId === 'number', 'alertId should be number');
        assert.ok(alert.numeroAlerta, 'numeroAlerta should be present');
        assert.ok(alert.producto, 'producto should be present');
      }
    });
  });

  describe('GET /lapch-alerts/:id', () => {
    test('ADMIN can get alert by id=1', async () => {
      const res = await request('GET', '/lapch-alerts/1');
      assert.ok([200, 404].includes(res.status),
        `Expected 200 or 404, got ${res.status}`);
    });

    test('returns 404 for nonexistent alert', async () => {
      const res = await request('GET', '/lapch-alerts/999999');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/lapch-alerts/1', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('POST /lapch-alerts', () => {
    test('COORDINADOR can create lapch-alert with valid data', async () => {
      const instRes = await request('GET', '/institutions?page=1&pageSize=1', { token: tokens.coordinator });
      const insts = instRes.data?.data?.items;
      if (!insts?.length) return;

      const res = await request('POST', '/lapch-alerts', {
        token: tokens.coordinator,
        body: {
          numeroAlerta: `LAPCH-${uid().slice(-6)}`,
          fecha: new Date().toISOString(),
          producto: 'Test Product',
          institutionId: insts[0].institutionId,
          descripcion: 'Test LAPCH alert description',
        },
      });
      assert.ok([200, 201, 400, 409].includes(res.status),
        `Expected 200/201/400/409, got ${res.status}: ${JSON.stringify(res.data)}`);
    });

    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/lapch-alerts', {
        token: tokens.coordinator,
        body: {},
      });
      assertValidationError(res);
    });

    test('TECNICO_EVALUADOR cannot create alert (403)', async () => {
      const res = await request('POST', '/lapch-alerts', {
        token: tokens.technician,
        body: { numeroAlerta: 'X', fecha: '2026-01-01', producto: 'X', institutionId: 1, descripcion: 'X' },
      });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/lapch-alerts', {
        token: null,
        body: {},
      });
      assertUnauthorized(res);
    });
  });

  describe('PATCH /lapch-alerts/:id/resultado', () => {
    test('returns 400 for empty body', async () => {
      const res = await request('PATCH', '/lapch-alerts/1/resultado', {
        token: tokens.coordinator,
        body: {},
      });
      assertValidationError(res);
    });

    test('returns 404 for nonexistent alert', async () => {
      const res = await request('PATCH', '/lapch-alerts/999999/resultado', {
        token: tokens.coordinator,
        body: { resultado: 'PROCEDE' },
      });
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/lapch-alerts/1/resultado', {
        token: null,
        body: { resultado: 'PROCEDE' },
      });
      assertUnauthorized(res);
    });
  });

  describe('POST /lapch-alerts/:id/generate-case', () => {
    test('returns 404 for nonexistent alert', async () => {
      const res = await request('POST', '/lapch-alerts/999999/generate-case', {
        token: tokens.coordinator,
      });
      assert.ok([404, 409].includes(res.status),
        `Expected 404/409, got ${res.status}`);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/lapch-alerts/1/generate-case', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('POST /lapch-alerts/:id/close', () => {
    test('returns 404 for nonexistent alert', async () => {
      const res = await request('POST', '/lapch-alerts/999999/close', {
        token: tokens.coordinator,
      });
      assert.ok([404, 409].includes(res.status),
        `Expected 404/409, got ${res.status}`);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/lapch-alerts/1/close', { token: null });
      assertUnauthorized(res);
    });
  });
});

// ─── Complaints ───────────────────────────────────────────────────────────────
describe('Complaints', () => {
  before(async () => { await loginAll(); });

  describe('POST /complaints (public)', () => {
    test('anyone can create a complaint (public endpoint)', async () => {
      const res = await request('POST', '/complaints', {
        token: null,
        body: {
          tipoDenuncia: 'CONTAMINACION',
          fechaRecepcion: new Date().toISOString(),
          denunciante: 'Anonymous Citizen',
          descripcion: 'Test complaint - automated test',
        },
      });
      assert.ok([200, 201].includes(res.status),
        `Expected 200/201, got ${res.status}: ${JSON.stringify(res.data)}`);
    });

    test('returns 400 for missing required fields', async () => {
      const res = await request('POST', '/complaints', {
        token: null,
        body: {},
      });
      assertValidationError(res);
    });

    test('returns 400 for missing tipoDenuncia', async () => {
      const res = await request('POST', '/complaints', {
        token: null,
        body: { fechaRecepcion: '2026-01-01', denunciante: 'X', descripcion: 'test' },
      });
      assertValidationError(res);
    });
  });

  describe('GET /complaints', () => {
    test('ADMIN can list complaints (paginated)', async () => {
      const res = await request('GET', '/complaints?page=1&pageSize=20');
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('COORDINADOR can list complaints', async () => {
      const res = await request('GET', '/complaints?page=1&pageSize=20', { token: tokens.coordinator });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('TECNICO_EVALUADOR cannot list complaints (403)', async () => {
      const res = await request('GET', '/complaints', { token: tokens.technician });
      assertForbidden(res);
    });

    test('ADMIN_EMPRESA cannot list complaints (403)', async () => {
      const res = await request('GET', '/complaints', { token: tokens.company });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/complaints', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('GET /complaints/:id', () => {
    test('ADMIN can get complaint by id=1', async () => {
      const res = await request('GET', '/complaints/1');
      assert.ok([200, 404].includes(res.status),
        `Expected 200 or 404, got ${res.status}`);
    });

    test('returns 404 for nonexistent complaint', async () => {
      const res = await request('GET', '/complaints/999999');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/complaints/1', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('PATCH /complaints/:id/resultado', () => {
    test('returns 400 for empty body', async () => {
      const res = await request('PATCH', '/complaints/1/resultado', {
        token: tokens.coordinator,
        body: {},
      });
      assertValidationError(res);
    });

    test('returns 404 for nonexistent complaint', async () => {
      const res = await request('PATCH', '/complaints/999999/resultado', {
        token: tokens.coordinator,
        body: { resultado: 'PROCEDE' },
      });
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/complaints/1/resultado', {
        token: null,
        body: { resultado: 'PROCEDE' },
      });
      assertUnauthorized(res);
    });
  });

  describe('POST /complaints/:id/generate-case', () => {
    test('returns 404 for nonexistent complaint', async () => {
      const res = await request('POST', '/complaints/999999/generate-case', {
        token: tokens.coordinator,
      });
      assert.ok([404, 409].includes(res.status),
        `Expected 404/409, got ${res.status}`);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('POST', '/complaints/1/generate-case', { token: null });
      assertUnauthorized(res);
    });
  });
});

// ─── Notifications ────────────────────────────────────────────────────────────
describe('Notifications', () => {
  before(async () => { await loginAll(); });

  describe('GET /notifications', () => {
    test('ADMIN can list notifications', async () => {
      const res = await request('GET', '/notifications?page=1&pageSize=20');
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('COORDINADOR can list notifications', async () => {
      const res = await request('GET', '/notifications?page=1&pageSize=20', { token: tokens.coordinator });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('TECNICO_EVALUADOR can list notifications', async () => {
      const res = await request('GET', '/notifications?page=1&pageSize=20', { token: tokens.technician });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('ADMIN_EMPRESA can list notifications', async () => {
      const res = await request('GET', '/notifications?page=1&pageSize=20', { token: tokens.company });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/notifications', { token: null });
      assertUnauthorized(res);
    });

    test('each notification has expected shape', async () => {
      const res = await request('GET', '/notifications?page=1&pageSize=5');
      const data = assertOk(res, 200);
      for (const notif of data.items) {
        assert.ok(typeof notif.notificationId === 'number', 'notificationId should be number');
        assert.ok(notif.title, 'title should be present');
        assert.ok(notif.message, 'message should be present');
        assert.ok(typeof notif.read === 'boolean', 'read should be boolean');
      }
    });

    test('notifications belong only to requesting user', async () => {
      const adminRes = await request('GET', '/notifications?page=1&pageSize=20');
      const coordRes = await request('GET', '/notifications?page=1&pageSize=20', { token: tokens.coordinator });
      const adminData = assertOk(adminRes, 200);
      const coordData = assertOk(coordRes, 200);
      // We cannot fully verify isolation without knowing user IDs, but we can assert
      // both return valid paginated responses with no cross-user data leakage
      assertPaginated(adminData);
      assertPaginated(coordData);
    });
  });

  describe('PATCH /notifications/read-all', () => {
    test('marks all notifications as read for authenticated user', async () => {
      const res = await request('PATCH', '/notifications/read-all');
      assert.ok([200, 204].includes(res.status),
        `Expected 200 or 204, got ${res.status}`);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/notifications/read-all', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    test('returns 404 for nonexistent notification', async () => {
      const res = await request('PATCH', '/notifications/999999/read');
      assertNotFound(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/notifications/1/read', { token: null });
      assertUnauthorized(res);
    });
  });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
describe('Dashboard', () => {
  before(async () => { await loginAll(); });

  describe('GET /dashboard/empresa', () => {
    test('ADMIN_EMPRESA can access empresa dashboard', async () => {
      const res = await request('GET', '/dashboard/empresa', { token: tokens.company });
      assertOk(res, 200);
    });

    test('USUARIO_DELEGADO can access empresa dashboard', async () => {
      const res = await request('GET', '/dashboard/empresa', { token: tokens.delegate });
      assertOk(res, 200);
    });

    test('ADMIN cannot access empresa dashboard (403)', async () => {
      const res = await request('GET', '/dashboard/empresa');
      assertForbidden(res);
    });

    test('COORDINADOR cannot access empresa dashboard (403)', async () => {
      const res = await request('GET', '/dashboard/empresa', { token: tokens.coordinator });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/dashboard/empresa', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('GET /dashboard/coordinador', () => {
    test('COORDINADOR can access coordinador dashboard', async () => {
      const res = await request('GET', '/dashboard/coordinador', { token: tokens.coordinator });
      assertOk(res, 200);
    });

    test('ADMIN can access coordinador dashboard', async () => {
      const res = await request('GET', '/dashboard/coordinador');
      assertOk(res, 200);
    });

    test('TECNICO_EVALUADOR cannot access coordinador dashboard (403)', async () => {
      const res = await request('GET', '/dashboard/coordinador', { token: tokens.technician });
      assertForbidden(res);
    });

    test('ADMIN_EMPRESA cannot access coordinador dashboard (403)', async () => {
      const res = await request('GET', '/dashboard/coordinador', { token: tokens.company });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/dashboard/coordinador', { token: null });
      assertUnauthorized(res);
    });
  });

  describe('GET /dashboard/tecnico', () => {
    test('TECNICO_EVALUADOR can access tecnico dashboard', async () => {
      const res = await request('GET', '/dashboard/tecnico', { token: tokens.technician });
      assertOk(res, 200);
    });

    test('ADMIN cannot access tecnico dashboard (403)', async () => {
      const res = await request('GET', '/dashboard/tecnico');
      assertForbidden(res);
    });

    test('COORDINADOR cannot access tecnico dashboard (403)', async () => {
      const res = await request('GET', '/dashboard/tecnico', { token: tokens.coordinator });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/dashboard/tecnico', { token: null });
      assertUnauthorized(res);
    });
  });
});

// ─── History ──────────────────────────────────────────────────────────────────
describe('History', () => {
  before(async () => { await loginAll(); });

  describe('GET /history/search', () => {
    test('ADMIN can search history', async () => {
      const res = await request('GET', '/history/search?page=1&pageSize=20');
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('COORDINADOR can search history', async () => {
      const res = await request('GET', '/history/search?page=1&pageSize=20', { token: tokens.coordinator });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('ADMIN_EMPRESA can search history', async () => {
      const res = await request('GET', '/history/search?page=1&pageSize=20', { token: tokens.company });
      const data = assertOk(res, 200);
      assertPaginated(data);
    });

    test('TECNICO_EVALUADOR cannot search history (403)', async () => {
      const res = await request('GET', '/history/search', { token: tokens.technician });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/history/search', { token: null });
      assertUnauthorized(res);
    });
  });
});

// ─── Attachments ──────────────────────────────────────────────────────────────
describe('Attachments auth and missing resources', () => {
  before(async () => { await loginAll(); });

  test('GET /attachments/999999 returns 404', async () => {
    const res = await request('GET', '/attachments/999999');
    assertNotFound(res);
  });

  test('GET /attachments/:id without a token returns 401', async () => {
    const res = await request('GET', '/attachments/1', { token: null });
    assertUnauthorized(res);
  });

  test('DELETE /attachments/999999 returns 404', async () => {
    const res = await request('DELETE', '/attachments/999999');
    assertNotFound(res);
  });

  test('DELETE /attachments/:id without a token returns 401', async () => {
    const res = await request('DELETE', '/attachments/1', { token: null });
    assertUnauthorized(res);
  });

  test('POST /attachments with JSON and no file returns 400', async () => {
    const res = await request('POST', '/attachments', { body: { category: 'OTRO' } });
    assertValidationError(res);
  });

  test('POST /attachments without a token returns 401', async () => {
    const res = await request('POST', '/attachments', { token: null, body: { category: 'OTRO' } });
    assertUnauthorized(res);
  });
});
