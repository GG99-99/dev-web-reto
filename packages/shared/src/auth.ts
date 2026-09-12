/**
 * auth.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Autenticación (RF-01).
 * Endpoints: /auth/login, /auth/logout, /auth/refresh, /auth/password/*,
 * /auth/2fa/*
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';

/**
 * Body de `POST /auth/login`.
 *
 * @example
 * ```ts
 * const body: LoginRequest = { usuario: '001-1234567-8', password: 's3cret!' };
 * await fetch('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(body) });
 * ```
 */
export interface LoginRequest {
  /** Email o cédula del usuario. */
  usuario: string;
  password: string;
}

/**
 * Usuario autenticado con sus relaciones incluidas (persona y rol).
 * Generado con `Prisma.UserGetPayload` para mantenerse sincronizado con el
 * schema de Prisma sin duplicar la definición de columnas.
 */
export type AuthenticatedUser = Prisma.UserGetPayload<{
  include: { person: true; role: true };
}>;

/**
 * Respuesta de `POST /auth/login`.
 *
 * @remarks
 * Si `requiresTwoFactor` es `true`, `tempToken` viene presente y `user`
 * viene ausente: el flujo continúa en `POST /auth/2fa/verify`.
 *
 * @example
 * ```ts
 * const { data } = await login(body) as ApiSuccessResponse<LoginResponse>;
 * if (data.requiresTwoFactor) {
 *   // navegar a pantalla de OTP usando data.tempToken
 * } else {
 *   saveSession(data.accessToken, data.refreshToken, data.user);
 * }
 * ```
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  /** Indica si el login debe completarse con un segundo factor (OTP). */
  requiresTwoFactor: boolean;
  /** Presente únicamente cuando `requiresTwoFactor` es `true`. */
  tempToken?: string;
  /** Ausente cuando `requiresTwoFactor` es `true`. */
  user?: AuthenticatedUser;
}

/** Body de `POST /auth/refresh`. */
export interface RefreshRequest {
  refreshToken: string;
}

/** Respuesta de `POST /auth/refresh`: nuevo par de tokens. */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/** Body de `POST /auth/password/forgot`. */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * Body de `POST /auth/password/reset`.
 * El `token` proviene del correo de recuperación (`PasswordResetToken`).
 */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/** Body de `POST /auth/password/change` (usuario ya autenticado). */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Respuesta de `POST /auth/2fa/enable`.
 *
 * @example
 * ```ts
 * const { data } = await enable2FA() as ApiSuccessResponse<Enable2FAResponse>;
 * renderQrCode(data.qrCodeUrl); // el usuario escanea con su app OTP
 * ```
 */
export interface Enable2FAResponse {
  /** Secreto TOTP en base32, para configuración manual. */
  secret: string;
  /** URL/otpauth para renderizar como código QR. */
  qrCodeUrl: string;
}

/** Body de `POST /auth/2fa/verify`, completa el login iniciado con `tempToken`. */
export interface Verify2FARequest {
  tempToken: string;
  /** Código OTP de 6 dígitos generado por la app del usuario. */
  code: string;
}
