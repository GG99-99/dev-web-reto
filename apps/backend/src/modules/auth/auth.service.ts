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
  if (!user) throw ApiError.internal('El usuario autenticado ya no existe');

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
    // `AuthenticatedUser` = Prisma.UserGetPayload<{ include: { person, role } }>;
    // se omite `password` a propósito (nunca debe viajar al cliente) aunque el
    // tipo generado por Prisma lo incluiría por defecto.
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
      throw ApiError.unauthorized('Usuario o contraseña incorrectos');
    }

    const { user } = person;

    const passwordMatches = await comparePassword(password, user.password);
    if (!passwordMatches) {
      throw ApiError.unauthorized('Usuario o contraseña incorrectos');
    }

    if (user.status !== 'APROBADO') {
      throw ApiError.forbidden(
        user.status === 'PENDIENTE_VALIDACION'
          ? 'Tu registro está pendiente de validación por un administrador'
          : 'Tu registro fue rechazado. Contacta a un administrador',
      );
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Tu cuenta está desactivada');
    }

    const twoFactor = await authModel.getTwoFactor(user.userId);
    if (twoFactor?.enabled) {
      const tempToken = signTempToken({ userId: user.userId, purpose: '2fa' });
      // Nota de contrato: `LoginResponse.accessToken/refreshToken` no son
      // opcionales en @reto/shared/auth.ts a pesar de que, según el `@remarks`
      // de esa misma interfaz, deben ir ausentes cuando `requiresTwoFactor`
      // es true. Se devuelven como string vacío para no romper el tipo.
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
      throw ApiError.unauthorized('Refresh token inválido o expirado');
    }

    const user = await authModel.getUserWithRoleByUserId(payload.userId);
    if (!user || !user.isActive || user.status !== 'APROBADO') {
      throw ApiError.unauthorized('El usuario ya no tiene acceso');
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
  // NOTA: los accessToken/refreshToken son JWT sin estado (no hay tabla de
  // sesiones/whitelist en el schema actual), por lo que no pueden invalidarse
  // server-side de verdad hasta agregar un registro de refresh tokens vigentes
  // (ver TODO en documentos/backend.txt). Por ahora solo se valida el token
  // recibido para responder de forma consistente con el contrato.
  logout: async (refreshToken: string): Promise<void> => {
    try {
      verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Refresh token inválido o expirado');
    }
  },

  /*********************
  |   PASSWORD FORGOT   |
   *********************/
  forgotPassword: async ({ email }: ForgotPasswordRequest): Promise<void> => {
    const person = await personService.getWithUserByEmail(email);
    // Nunca revelamos si el email existe o no (evita enumeración de usuarios).
    if (!person?.user) return;

    const resetToken = await authModel.createPasswordResetToken(person.user.userId, PASSWORD_RESET_TTL_MS);

    // TODO(backend.txt): no hay proveedor de correo configurado en el monorepo.
    // Se deja el token logueado para desarrollo; en producción debe enviarse
    // por email usando el link .../reset-password?token=<token>.
    console.info(`[auth] password reset token para ${email}: ${resetToken.token}`);
  },

  resetPassword: async ({ token, newPassword }: ResetPasswordRequest): Promise<void> => {
    const record = await authModel.getValidPasswordResetToken(token);
    if (!record) throw ApiError.validation('El token de recuperación es inválido o expiró');

    const passwordHash = await hashPassword(newPassword);
    await authModel.updatePassword(record.userId, passwordHash);
    await authModel.markPasswordResetTokenUsed(record.tokenId);
  },

  changePassword: async (userId: number, { currentPassword, newPassword }: ChangePasswordRequest): Promise<void> => {
    const user = await authModel.getUserWithRoleByUserId(userId);
    if (!user) throw ApiError.notFound('El usuario no existe');

    const matches = await comparePassword(currentPassword, user.password);
    if (!matches) throw ApiError.validation('La contraseña actual es incorrecta');

    const passwordHash = await hashPassword(newPassword);
    await authModel.updatePassword(userId, passwordHash);
  },

  /*********
  |   2FA   |
   *********/
  enable2FA: async (userId: number): Promise<Enable2FAResponse> => {
    const user = await authModel.getUserWithRoleByUserId(userId);
    if (!user) throw ApiError.notFound('El usuario no existe');

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
      throw ApiError.unauthorized('El token temporal es inválido o expiró');
    }

    const twoFactor = await authModel.getTwoFactor(payload.userId);
    if (!twoFactor?.enabled) throw ApiError.validation('El 2FA no está activo para este usuario');

    const isValid = verifyTotp(twoFactor.secret, code);
    if (!isValid) throw ApiError.validation('Código OTP incorrecto');

    return buildLoginResponse(payload.userId);
  },
};
