/**
 * 03-roles-catalogs.test.mjs
 * ---------------------------------------------------------------------------
 * Tests for:
 *  - GET /roles (role catalog)
 *  - GET /catalogs/provinces
 *  - GET /catalogs/municipalities?provinceId=X
 *  - GET /catalogs/health-areas
 *  - GET /catalogs/categories
 *  - GET /catalogs/categories/:id/subcategories
 *  - GET /catalogs/foods?categoryId=X
 *  - GET /catalogs/risk-frequency-rules  (ADMIN only)
 *  - PATCH /catalogs/risk-frequency-rules/:id (ADMIN only)
 * ---------------------------------------------------------------------------
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  request, loginAll, tokens,
  assertOk, assertUnauthorized, assertForbidden, assertValidationError, assertNotFound,
} from './helpers.mjs';

describe('Roles', () => {
  before(async () => { await loginAll(); });

  test('GET /roles returns 200 for ADMIN with list of roles', async () => {
    const res = await request('GET', '/roles');
    const data = assertOk(res, 200);
    assert.ok(Array.isArray(data), 'roles should be an array');
    assert.ok(data.length >= 5, 'Should have at least 5 roles');
    const names = data.map(r => r.name);
    assert.ok(names.includes('ADMIN'), 'Should include ADMIN role');
    assert.ok(names.includes('COORDINADOR'), 'Should include COORDINADOR role');
    assert.ok(names.includes('TECNICO_EVALUADOR'), 'Should include TECNICO_EVALUADOR role');
    assert.ok(names.includes('ADMIN_EMPRESA'), 'Should include ADMIN_EMPRESA role');
    assert.ok(names.includes('USUARIO_DELEGADO'), 'Should include USUARIO_DELEGADO role');
  });

  test('GET /roles returns 401 without token', async () => {
    const res = await request('GET', '/roles', { token: null });
    assertUnauthorized(res);
  });
});

describe('Catalogs', () => {
  before(async () => { await loginAll(); });

  // ── Provinces ─────────────────────────────────────────────────────────────
  describe('GET /catalogs/provinces', () => {
    test('returns 200 with list of provinces', async () => {
      const res = await request('GET', '/catalogs/provinces');
      const data = assertOk(res, 200);
      assert.ok(Array.isArray(data), 'provinces should be an array');
      assert.ok(data.length > 0, 'Should have provinces');
      assert.ok(data[0].provinceId, 'Province should have provinceId');
      assert.ok(data[0].name, 'Province should have name');
    });

    test('returns 401 without token', async () => {
      const res = await request('GET', '/catalogs/provinces', { token: null });
      assertUnauthorized(res);
    });

    test('COORDINADOR can access provinces', async () => {
      const res = await request('GET', '/catalogs/provinces', { token: tokens.coordinator });
      assertOk(res, 200);
    });
  });

  // ── Municipalities ────────────────────────────────────────────────────────
  describe('GET /catalogs/municipalities', () => {
    test('returns 200 with municipalities for provinceId=1', async () => {
      const res = await request('GET', '/catalogs/municipalities?provinceId=1');
      const data = assertOk(res, 200);
      assert.ok(Array.isArray(data), 'municipalities should be an array');
    });

    test('returns 200 with all municipalities when provinceId is omitted (optional filter)', async () => {
      // provinceId is optional - returns all municipalities when omitted
      const res = await request('GET', '/catalogs/municipalities');
      const data = assertOk(res, 200);
      assert.ok(Array.isArray(data), 'municipalities should be an array');
      assert.ok(data.length > 0, 'Should return all municipalities when no filter');
    });

    test('returns 401 without token', async () => {
      const res = await request('GET', '/catalogs/municipalities?provinceId=1', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── Health Areas ──────────────────────────────────────────────────────────
  describe('GET /catalogs/health-areas', () => {
    test('returns 200 with list of health areas', async () => {
      const res = await request('GET', '/catalogs/health-areas');
      const data = assertOk(res, 200);
      assert.ok(Array.isArray(data), 'health-areas should be an array');
    });

    test('returns 401 without token', async () => {
      const res = await request('GET', '/catalogs/health-areas', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── Categories ────────────────────────────────────────────────────────────
  describe('GET /catalogs/categories', () => {
    test('returns 200 with list of categories', async () => {
      const res = await request('GET', '/catalogs/categories');
      const data = assertOk(res, 200);
      assert.ok(Array.isArray(data), 'categories should be an array');
      assert.ok(data.length > 0, 'Should have categories');
      assert.ok(data[0].categoryId, 'Category should have categoryId');
      assert.ok(data[0].name, 'Category should have name');
    });

    test('returns 401 without token', async () => {
      const res = await request('GET', '/catalogs/categories', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── Subcategories ─────────────────────────────────────────────────────────
  describe('GET /catalogs/categories/:id/subcategories', () => {
    test('returns 200 with subcategories for categoryId=1', async () => {
      const res = await request('GET', '/catalogs/categories/1/subcategories');
      const data = assertOk(res, 200);
      assert.ok(Array.isArray(data), 'subcategories should be an array');
    });

    test('returns 401 without token', async () => {
      const res = await request('GET', '/catalogs/categories/1/subcategories', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── Foods ─────────────────────────────────────────────────────────────────
  describe('GET /catalogs/foods', () => {
    test('returns 200 with foods for categoryId=1', async () => {
      const res = await request('GET', '/catalogs/foods?categoryId=1');
      const data = assertOk(res, 200);
      assert.ok(Array.isArray(data), 'foods should be an array');
    });

    test('returns 200 with all foods when categoryId is omitted (optional filter)', async () => {
      // categoryId is optional - returns all foods when omitted
      const res = await request('GET', '/catalogs/foods');
      const data = assertOk(res, 200);
      assert.ok(Array.isArray(data), 'foods should be an array');
    });

    test('returns 401 without token', async () => {
      const res = await request('GET', '/catalogs/foods?categoryId=1', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── Risk Frequency Rules ──────────────────────────────────────────────────
  describe('GET /catalogs/risk-frequency-rules', () => {
    test('ADMIN can get risk frequency rules', async () => {
      const res = await request('GET', '/catalogs/risk-frequency-rules');
      const data = assertOk(res, 200);
      assert.ok(Array.isArray(data), 'rules should be an array');
    });

    test('COORDINADOR is forbidden from risk rules', async () => {
      const res = await request('GET', '/catalogs/risk-frequency-rules', { token: tokens.coordinator });
      assertForbidden(res);
    });

    test('TECNICO_EVALUADOR is forbidden from risk rules', async () => {
      const res = await request('GET', '/catalogs/risk-frequency-rules', { token: tokens.technician });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('GET', '/catalogs/risk-frequency-rules', { token: null });
      assertUnauthorized(res);
    });
  });

  // ── PATCH /catalogs/risk-frequency-rules/:id ──────────────────────────────
  describe('PATCH /catalogs/risk-frequency-rules/:id', () => {
    test('ADMIN can update a risk rule', async () => {
      // Get the first rule ID
      const listRes = await request('GET', '/catalogs/risk-frequency-rules');
      const rules = assertOk(listRes, 200);
      if (rules.length === 0) {
        // Skip if no rules
        return;
      }
      const firstRule = rules[0];
      const res = await request('PATCH', `/catalogs/risk-frequency-rules/${firstRule.ruleId}`, {
        body: { minScore: firstRule.minScore, maxScore: firstRule.maxScore, riskLevel: firstRule.riskLevel, frequency: firstRule.frequency },
      });
      assertOk(res, 200);
    });

    test('returns 404 for nonexistent rule', async () => {
      const res = await request('PATCH', '/catalogs/risk-frequency-rules/999999', {
        body: { minScore: 1, riskLevel: 'BAJO', frequency: 'ANUAL' },
      });
      assertNotFound(res);
    });

    test('COORDINADOR cannot update risk rules', async () => {
      const res = await request('PATCH', '/catalogs/risk-frequency-rules/1', {
        token: tokens.coordinator,
        body: { minScore: 1, riskLevel: 'BAJO', frequency: 'ANUAL' },
      });
      assertForbidden(res);
    });

    test('unauthenticated gets 401', async () => {
      const res = await request('PATCH', '/catalogs/risk-frequency-rules/1', {
        token: null,
        body: {},
      });
      assertUnauthorized(res);
    });
  });
});
