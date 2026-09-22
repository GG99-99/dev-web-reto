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
    // Never reveal whether the email exists or not (prevents user enumeration).
    if (!person?.user) return;

    const resetToken = await authModel.createPasswordResetToken(person.user.userId, PASSWORD_RESET_TTL_MS);

    // TODO: No email provider is configured in the monorepo.
    // The token is logged for development; in production it should be sent via email.
    console.info(`[auth] password reset token for ${email}: ${resetToken.token}`);
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
