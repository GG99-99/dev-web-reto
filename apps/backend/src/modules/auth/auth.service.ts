import type {
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  Enable2FAResponse,
  Verify2FARequest,
  AuthenticatedUser,
  UserRole,
} from '@reto/shared';
import { authModel } from './auth.model';
import { personService } from '../person/person.service';
import { ApiError } from '@/lib/common/ApiError';
import { mailService } from '@/lib/mail/mail.service';
import { renderOperationalEmail } from '@/lib/mail/email-layout';
import { hashPassword, comparePassword } from '@/lib/auth/password';
import { generateTotpSecret, verifyTotp, buildOtpAuthUrl } from '@/lib/auth/totp';
import {
  signAccessToken,
  signRefreshToken,
  signTempToken,
  verifyRefreshToken,
  verifyTempToken,
} from '@/lib/auth/jwt';

/**
 * auth.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio de RF-01 (Autenticación). Sección 1 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

/** Origin placed in recovery links. APP_PUBLIC_URL wins; otherwise the first real CORS origin. */
function appPublicOrigin(): string {
  const configured = process.env.APP_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const cors = process.env.CORS_ORIGIN?.split(',')
    .map((value) => value.trim())
    .find((value) => value && value !== '*');
  return (cors || 'http://localhost:5173').replace(/\/$/, '');
}

/** Construye el par de tokens + AuthenticatedUser una vez pasado el login/2FA. */
async function buildLoginResponse(userId: number): Promise<LoginResponse> {
  const user = await authModel.getUserWithRoleByUserIdSafe(userId);
  if (!user) throw ApiError.internal('The authenticated user no longer exists');

  const accessToken = signAccessToken({
    userId: user.userId,
    personId: user.personId,
    roleId: user.roleId,
    role: (user.role?.name as UserRole | undefined) ?? null,
  });
  const refreshToken = signRefreshToken({ userId: user.userId });

  return {
    accessToken,
    refreshToken,
    requiresTwoFactor: false,
    user: user as unknown as AuthenticatedUser,
  };
}

export const authService = {
  /*********
  |   LOGIN |
   *********/
  login: async ({ usuario, password }: LoginRequest): Promise<LoginResponse> => {
    const person = await personService.getWithUserByUsuario(usuario);

    if (!person || !person.user) {
      throw ApiError.unauthorized('Incorrect username or password');
    }

    const { user } = person;

    const passwordMatches = await comparePassword(password, user.password);
    if (!passwordMatches) {
      throw ApiError.unauthorized('Incorrect username or password');
    }

    if (user.status !== 'APROBADO') {
      throw ApiError.forbidden(
        user.status === 'PENDIENTE_VALIDACION'
          ? 'Your registration is pending approval by an administrator'
          : 'Your registration was rejected. Please contact an administrator',
      );
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated');
    }

    const twoFactor = await authModel.getTwoFactor(user.userId);
    if (twoFactor?.enabled) {
      const tempToken = signTempToken({ userId: user.userId, purpose: '2fa' });
      return {
        accessToken: '',
        refreshToken: '',
        requiresTwoFactor: true,
        tempToken,
      };
    }

    return buildLoginResponse(user.userId);
  },

  /************
  |   REFRESH  |
   ************/
  refresh: async ({ refreshToken }: RefreshRequest): Promise<RefreshResponse> => {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const user = await authModel.getUserWithRoleByUserId(payload.userId);
    if (!user || !user.isActive || user.status !== 'APROBADO') {
      throw ApiError.unauthorized('User no longer has access');
    }

    return {
      accessToken: signAccessToken({
        userId: user.userId,
        personId: user.personId,
        roleId: user.roleId,
        role: (user.role?.name as UserRole | undefined) ?? null,
      }),
      refreshToken: signRefreshToken({ userId: user.userId }),
    };
  },

  /***********
  |   LOGOUT  |
   ***********/
  logout: async (refreshToken: string): Promise<void> => {
    try {
      verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }
  },

  /*********************
  |   PASSWORD FORGOT   |
   *********************/
  forgotPassword: async ({ email }: ForgotPasswordRequest): Promise<void> => {
    const person = await personService.getWithUserByEmail(email);
    // Same response whether or not the address is registered (no account enumeration).
    if (!person?.user) return;

    await authModel.retireUnusedPasswordResetTokens(person.user.userId);
    const resetToken = await authModel.createPasswordResetToken(person.user.userId, PASSWORD_RESET_TTL_MS);
    const resetUrl = `${appPublicOrigin()}/?reset=${encodeURIComponent(resetToken.token)}`;
    const subject = 'Reset your RADAR password';
    const text = [
      'We received a request to reset the password for your RADAR account.',
      'This link expires in 1 hour and can be used only once.',
      resetUrl,
      'If you did not request this, you can ignore this message. Your password will stay the same.',
    ].join('\n\n');
    const html = renderOperationalEmail({
      heading: 'Reset your password',
      paragraphs: [
        'We received a request to reset the password for your RADAR account.',
        'Choose a new password with the button below. This link expires in 1 hour and can be used only once.',
      ],
      details: [
        { label: 'Account', value: person.email },
        { label: 'Expires', value: 'In 1 hour' },
      ],
      action: { label: 'Choose a new password', href: resetUrl },
      footnote: 'If you did not request this, you can ignore this message. Your password will stay the same.',
    });

    const delivered = await mailService.sendMail({
      to: person.email,
      subject,
      text,
      html,
    });
    if (!delivered) {
      console.info(`[auth] Recovery email was not delivered to ${person.email}. Reset link: ${resetUrl}`);
    }
  },

  resetPassword: async ({ token, newPassword }: ResetPasswordRequest): Promise<void> => {
    const record = await authModel.getValidPasswordResetToken(token);
    if (!record) throw ApiError.validation('The recovery token is invalid or has expired');

    const passwordHash = await hashPassword(newPassword);
    await authModel.updatePassword(record.userId, passwordHash);
    await authModel.markPasswordResetTokenUsed(record.tokenId);
  },

  changePassword: async (userId: number, { currentPassword, newPassword }: ChangePasswordRequest): Promise<void> => {
    const user = await authModel.getUserWithRoleByUserId(userId);
    if (!user) throw ApiError.notFound('User not found');

    const matches = await comparePassword(currentPassword, user.password);
    if (!matches) throw ApiError.validation('Current password is incorrect');

    const passwordHash = await hashPassword(newPassword);
    await authModel.updatePassword(userId, passwordHash);
  },

  /*********
  |   2FA   |
   *********/
  enable2FA: async (userId: number): Promise<Enable2FAResponse> => {
    const user = await authModel.getUserWithRoleByUserId(userId);
    if (!user) throw ApiError.notFound('User not found');

    const secret = generateTotpSecret();
    await authModel.upsertTwoFactor(userId, secret, true);

    return {
      secret,
      qrCodeUrl: buildOtpAuthUrl({ secret, accountName: user.person.email }),
    };
  },

  verify2FA: async ({ tempToken, code }: Verify2FARequest): Promise<LoginResponse> => {
    let payload;
    try {
      payload = verifyTempToken(tempToken);
    } catch {
      throw ApiError.unauthorized('The temporary token is invalid or has expired');
    }

    const twoFactor = await authModel.getTwoFactor(payload.userId);
    if (!twoFactor?.enabled) throw ApiError.validation('2FA is not enabled for this user');

    const isValid = verifyTotp(twoFactor.secret, code);
    if (!isValid) throw ApiError.validation('Incorrect OTP code');

    return buildLoginResponse(payload.userId);
  },
};
