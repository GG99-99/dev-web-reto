/**
 * 01-auth.test.mjs
 * ---------------------------------------------------------------------------
 * POST /auth/login, /auth/logout, /auth/refresh,
 * /auth/password/forgot, /auth/password/reset, /auth/password/change,
 * /auth/2fa/enable, /auth/2fa/verify
 *
 * 2FA is exercised only on an isolated registered user — never on seeded
 * admin/coordinator/technician accounts.
 * ---------------------------------------------------------------------------
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  request, loginAs, tokens, refreshTokens, sessionUsers,
  assertOk, assertError, assertUnauthorized, assertValidationError, assertForbidden,
  registerUser, generateTotp, disableTwoFactorForUser, disableAllTwoFactor,
  latestPasswordResetToken, uniqueEmail, uniqueCedula, uid, PASSWORD,
} from './helpers.mjs';

describe('Auth', () => {
  before(async () => {
    disableAllTwoFactor();
    await loginAs('admin');
  });

  after(() => {
    disableAllTwoFactor();
  });

  describe('POST /auth/login', () => {
    test('returns 200 and tokens for valid admin credentials', async () => {
      const res = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: 'admin@salud.gob.do', password: PASSWORD },
      });
      const data = assertOk(res, 200);
      assert.ok(data.accessToken);
      assert.ok(data.refreshToken);
      assert.strictEqual(data.requiresTwoFactor, false);
      assert.strictEqual(data.user.role.name, 'ADMIN');
      assert.ok(data.user.person?.name);
    });

    test('returns 200 for coordinator', async () => {
      const res = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: 'coordinador@salud.gob.do', password: PASSWORD },
      });
      const data = assertOk(res, 200);
      assert.strictEqual(data.user.role.name, 'COORDINADOR');
    });

    test('returns 200 for technician', async () => {
      const res = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: 'tecnico1@salud.gob.do', password: PASSWORD },
      });
      const data = assertOk(res, 200);
      assert.strictEqual(data.user.role.name, 'TECNICO_EVALUADOR');
    });

    test('returns 200 for company admin', async () => {
      const res = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: 'admin@lacteosdelnorte.do', password: PASSWORD },
      });
      const data = assertOk(res, 200);
      assert.strictEqual(data.user.role.name, 'ADMIN_EMPRESA');
    });

    test('returns 200 for delegated company user', async () => {
      const res = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: 'delegado@lacteosdelnorte.do', password: PASSWORD },
      });
      const data = assertOk(res, 200);
      assert.strictEqual(data.user.role.name, 'USUARIO_DELEGADO');
    });

    test('returns 200 when logging in with national ID (cédula)', async () => {
      const res = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: '001-0000001-1', password: PASSWORD },
      });
      const data = assertOk(res, 200);
      assert.strictEqual(data.user.role.name, 'ADMIN');
    });

    test('returns 401 for wrong password', async () => {
      const res = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: 'admin@salud.gob.do', password: 'WRONG_PASSWORD' },
      });
      assertError(res, 401, 'UNAUTHORIZED');
    });

    test('returns 401 for nonexistent user', async () => {
      const res = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: 'nobody@nowhere.com', password: PASSWORD },
      });
      assertError(res, 401, 'UNAUTHORIZED');
    });

    test('does not reveal whether email exists for wrong password', async () => {
      const res1 = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: 'admin@salud.gob.do', password: 'WRONG' },
      });
      const res2 = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: 'nonexistent@example.com', password: 'WRONG' },
      });
      assert.strictEqual(res1.status, 401);
      assert.strictEqual(res2.status, 401);
      assert.strictEqual(res1.data.error.message, res2.data.error.message);
    });

    test('returns 400 when usuario is missing', async () => {
      const res = await request('POST', '/auth/login', { token: null, body: { password: PASSWORD } });
      assertValidationError(res);
    });

    test('returns 400 when password is missing', async () => {
      const res = await request('POST', '/auth/login', { token: null, body: { usuario: 'admin@salud.gob.do' } });
      assertValidationError(res);
    });

    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/auth/login', { token: null, body: {} });
      assertValidationError(res);
    });

    test('returns 403 for a user pending approval', async () => {
      const pending = await registerUser({ approve: false, email: uniqueEmail('pending') });
      const res = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: pending.email, password: pending.password },
      });
      assertForbidden(res);
    });
  });

  describe('POST /auth/refresh', () => {
    test('returns 200 with new tokens for valid refreshToken', async () => {
      const res = await request('POST', '/auth/refresh', {
        token: null,
        body: { refreshToken: refreshTokens.admin },
      });
      const data = assertOk(res, 200);
      assert.ok(data.accessToken);
      assert.ok(data.refreshToken);
      const probe = await request('GET', '/roles', { token: data.accessToken });
      assertOk(probe, 200);
    });

    test('returns 401 for invalid refreshToken', async () => {
      const res = await request('POST', '/auth/refresh', {
        token: null,
        body: { refreshToken: 'not-a-valid-jwt' },
      });
      assertError(res, 401, 'UNAUTHORIZED');
    });

    test('returns 400 when refreshToken is missing', async () => {
      const res = await request('POST', '/auth/refresh', { token: null, body: {} });
      assertValidationError(res);
    });
  });

  describe('POST /auth/logout', () => {
    test('returns 200 for valid logout', async () => {
      const loginRes = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: 'admin@salud.gob.do', password: PASSWORD },
      });
      const { accessToken, refreshToken } = loginRes.data.data;
      const res = await request('POST', '/auth/logout', { token: accessToken, body: { refreshToken } });
      assertOk(res, 200);
    });

    test('returns 401 without access token', async () => {
      const res = await request('POST', '/auth/logout', {
        token: null,
        body: { refreshToken: refreshTokens.admin },
      });
      assertUnauthorized(res);
    });

    test('returns 400 when refreshToken is missing in body', async () => {
      const res = await request('POST', '/auth/logout', { token: tokens.admin, body: {} });
      assertValidationError(res);
    });

    test('returns 401 for a malformed access token', async () => {
      const res = await request('GET', '/roles', { token: 'definitely-not-a-jwt' });
      assertUnauthorized(res);
    });
  });

  describe('POST /auth/password/forgot', () => {
    test('returns 200 for known email (no user enumeration)', async () => {
      const res = await request('POST', '/auth/password/forgot', {
        token: null,
        body: { email: 'admin@salud.gob.do' },
      });
      assertOk(res, 200);
    });

    test('returns 200 for unknown email (no user enumeration)', async () => {
      const res = await request('POST', '/auth/password/forgot', {
        token: null,
        body: { email: 'doesnotexist@example.com' },
      });
      assertOk(res, 200);
    });

    test('returns 400 for invalid email format', async () => {
      const res = await request('POST', '/auth/password/forgot', {
        token: null,
        body: { email: 'not-an-email' },
      });
      assertValidationError(res);
    });

    test('returns 400 for missing email', async () => {
      const res = await request('POST', '/auth/password/forgot', { token: null, body: {} });
      assertValidationError(res);
    });
  });

  describe('POST /auth/password/reset', () => {
    test('returns 400 for missing token', async () => {
      const res = await request('POST', '/auth/password/reset', {
        token: null,
        body: { newPassword: 'NewPass123!' },
      });
      assertValidationError(res);
    });

    test('returns 400 for missing newPassword', async () => {
      const res = await request('POST', '/auth/password/reset', {
        token: null,
        body: { token: 'sometoken' },
      });
      assertValidationError(res);
    });

    test('returns 400 for newPassword shorter than 8 characters', async () => {
      const res = await request('POST', '/auth/password/reset', {
        token: null,
        body: { token: 'sometoken', newPassword: 'short' },
      });
      assertValidationError(res);
    });

    test('returns 400 for invalid/expired reset token', async () => {
      const res = await request('POST', '/auth/password/reset', {
        token: null,
        body: { token: 'invalid-token-that-does-not-exist', newPassword: 'NewPass123!' },
      });
      assertValidationError(res);
    });

    test('resets password with a token issued by forgot-password', async () => {
      const isolated = await registerUser({ email: uniqueEmail('reset') });
      const forgot = await request('POST', '/auth/password/forgot', {
        token: null,
        body: { email: isolated.email },
      });
      assertOk(forgot, 200);
      const resetToken = latestPasswordResetToken();
      const newPassword = `Reset${uid('p')}!`;
      const reset = await request('POST', '/auth/password/reset', {
        token: null,
        body: { token: resetToken, newPassword },
      });
      assertOk(reset, 200);

      const oldLogin = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: isolated.email, password: isolated.password },
      });
      assertError(oldLogin, 401, 'UNAUTHORIZED');

      const newLogin = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: isolated.email, password: newPassword },
      });
      assertOk(newLogin, 200);
    });
  });

  describe('POST /auth/password/change', () => {
    test('returns 401 without access token', async () => {
      const res = await request('POST', '/auth/password/change', {
        token: null,
        body: { currentPassword: PASSWORD, newPassword: 'NewPass456!' },
      });
      assertUnauthorized(res);
    });

    test('returns 400 for incorrect current password', async () => {
      const res = await request('POST', '/auth/password/change', {
        token: tokens.admin,
        body: { currentPassword: 'WRONG_PASSWORD', newPassword: 'NewPass456!' },
      });
      assertValidationError(res);
    });

    test('returns 400 when newPassword is too short', async () => {
      const res = await request('POST', '/auth/password/change', {
        token: tokens.admin,
        body: { currentPassword: PASSWORD, newPassword: 'short' },
      });
      assertValidationError(res);
    });

    test('returns 400 for empty body', async () => {
      const res = await request('POST', '/auth/password/change', { token: tokens.admin, body: {} });
      assertValidationError(res);
    });

    test('changes password for an isolated user and accepts the new password', async () => {
      const isolated = await registerUser({ email: uniqueEmail('chg') });
      const login = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: isolated.email, password: isolated.password },
      });
      const { accessToken } = assertOk(login, 200);
      const newPassword = `Chg${uid('p')}!`;
      const change = await request('POST', '/auth/password/change', {
        token: accessToken,
        body: { currentPassword: isolated.password, newPassword },
      });
      assertOk(change, 200);

      const withOld = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: isolated.email, password: isolated.password },
      });
      assertError(withOld, 401, 'UNAUTHORIZED');

      const withNew = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: isolated.email, password: newPassword },
      });
      assertOk(withNew, 200);
    });
  });

  describe('POST /auth/2fa/enable and /auth/2fa/verify', () => {
    test('returns 401 without access token', async () => {
      const res = await request('POST', '/auth/2fa/enable', { token: null });
      assertUnauthorized(res);
    });

    test('enables 2FA on an isolated user, rejects a bad OTP, then verifies a valid TOTP', async () => {
      const isolated = await registerUser({ email: uniqueEmail('2fa'), cedula: uniqueCedula() });
      const firstLogin = await request('POST', '/auth/login', {
        token: null,
        body: { usuario: isolated.email, password: isolated.password },
      });
      const { accessToken } = assertOk(firstLogin, 200);

      const enable = await request('POST', '/auth/2fa/enable', { token: accessToken });
      const enabled = assertOk(enable, 200);
      assert.ok(enabled.secret);
      assert.ok(enabled.qrCodeUrl.startsWith('otpauth://'));

      try {
        const challenge = await request('POST', '/auth/login', {
          token: null,
          body: { usuario: isolated.email, password: isolated.password },
        });
        const challengeData = assertOk(challenge, 200);
        assert.strictEqual(challengeData.requiresTwoFactor, true);
        assert.ok(challengeData.tempToken);
        assert.ok(!challengeData.user);

        const badOtp = await request('POST', '/auth/2fa/verify', {
          token: null,
          body: { tempToken: challengeData.tempToken, code: '000000' },
        });
        assertValidationError(badOtp);

        const code = generateTotp(enabled.secret);
        const verified = await request('POST', '/auth/2fa/verify', {
          token: null,
          body: { tempToken: challengeData.tempToken, code },
        });
        const session = assertOk(verified, 200);
        assert.ok(session.accessToken);
        assert.strictEqual(session.requiresTwoFactor, false);
        assert.ok(session.user);

        const seeded = await request('POST', '/auth/login', {
          token: null,
          body: { usuario: 'admin@salud.gob.do', password: PASSWORD },
        });
        const seededData = assertOk(seeded, 200);
        assert.strictEqual(seededData.requiresTwoFactor, false);
        assert.ok(seededData.accessToken);
      } finally {
        disableTwoFactorForUser(isolated.userId);
      }
    });

    test('returns 400 for missing tempToken', async () => {
      const res = await request('POST', '/auth/2fa/verify', { token: null, body: { code: '123456' } });
      assertValidationError(res);
    });

    test('returns 400 for missing code', async () => {
      const res = await request('POST', '/auth/2fa/verify', { token: null, body: { tempToken: 'some-temp-token' } });
      assertValidationError(res);
    });

    test('returns 400 when code is not 6 digits', async () => {
      const res = await request('POST', '/auth/2fa/verify', {
        token: null,
        body: { tempToken: 'some-temp-token', code: '12345' },
      });
      assertValidationError(res);
    });

    test('returns 401 for invalid tempToken', async () => {
      const res = await request('POST', '/auth/2fa/verify', {
        token: null,
        body: { tempToken: 'invalid-temp-token', code: '123456' },
      });
      assertUnauthorized(res);
    });
  });

  describe('Protected route access control', () => {
    test('POST /auth/logout returns 401 without token', async () => {
      const res = await request('POST', '/auth/logout', { token: null, body: { refreshToken: 'x' } });
      assertUnauthorized(res);
    });

    test('POST /auth/password/change returns 401 without token', async () => {
      const res = await request('POST', '/auth/password/change', {
        token: null,
        body: { currentPassword: 'x', newPassword: 'abcdefgh' },
      });
      assertUnauthorized(res);
    });

    test('seeded admin remains usable after isolated 2FA tests', async () => {
      const res = await request('GET', '/roles', { token: tokens.admin });
      assertOk(res, 200);
      assert.ok(sessionUsers.admin?.userId);
    });
  });
});
