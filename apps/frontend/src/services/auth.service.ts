/**
 * auth.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Autenticación (RF-01).
 * Ver API_CONTRACTS.md, sección 1.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  Enable2FAResponse,
  Verify2FARequest,
} from '@reto/shared';

/**
 * `POST /auth/login` — Público.
 * Si `data.requiresTwoFactor` es `true`, continuar con {@link verify2FA}.
 *
 * @example
 * ```ts
 * const res = await authService.login({ usuario: 'ana@empresa.com', password: 's3cret!' });
 * if (res.valid && !res.data.requiresTwoFactor) {
 *   saveSession(res.data.accessToken, res.data.refreshToken);
 * }
 * ```
 */
async function login(body: LoginRequest): Promise<ApiResponse<LoginResponse>> {
  const { data } = await httpClient.post<ApiResponse<LoginResponse>>('/auth/login', body);
  return data;
}

/**
 * `POST /auth/logout` — Autenticado. Invalida el `refreshToken` actual en el backend.
 *
 * @example
 * ```ts
 * await authService.logout();
 * clearLocalSession();
 * ```
 */
async function logout(): Promise<ApiResponse<null>> {
  const { data } = await httpClient.post<ApiResponse<null>>('/auth/logout');
  return data;
}

/**
 * `POST /auth/refresh` — Público (requiere `refreshToken` válido).
 *
 * @remarks
 * En el flujo normal de la app no necesitas llamar esto manualmente: el
 * interceptor de `httpClient` ya lo dispara automáticamente ante un 401.
 * Úsalo solo para refrescos explícitos (ej. al iniciar la app).
 */
async function refresh(body: RefreshRequest): Promise<ApiResponse<RefreshResponse>> {
  const { data } = await httpClient.post<ApiResponse<RefreshResponse>>('/auth/refresh', body);
  return data;
}

/**
 * `POST /auth/password/forgot` — Público. Envía un correo con el link/token de recuperación.
 *
 * @example
 * ```ts
 * await authService.forgotPassword({ email: 'ana@empresa.com' });
 * ```
 */
async function forgotPassword(body: ForgotPasswordRequest): Promise<ApiResponse<null>> {
  const { data } = await httpClient.post<ApiResponse<null>>('/auth/password/forgot', body);
  return data;
}

/**
 * `POST /auth/password/reset` — Público (requiere `token` de `PasswordResetToken`).
 */
async function resetPassword(body: ResetPasswordRequest): Promise<ApiResponse<null>> {
  const { data } = await httpClient.post<ApiResponse<null>>('/auth/password/reset', body);
  return data;
}

/**
 * `POST /auth/password/change` — Autenticado (usuario ya logueado cambiando su propia contraseña).
 */
async function changePassword(body: ChangePasswordRequest): Promise<ApiResponse<null>> {
  const { data } = await httpClient.post<ApiResponse<null>>('/auth/password/change', body);
  return data;
}

/**
 * `POST /auth/2fa/enable` — Autenticado. Devuelve el secreto TOTP y el QR a escanear.
 *
 * @example
 * ```ts
 * const res = await authService.enable2FA();
 * if (res.valid) renderQrCode(res.data.qrCodeUrl);
 * ```
 */
async function enable2FA(): Promise<ApiResponse<Enable2FAResponse>> {
  const { data } = await httpClient.post<ApiResponse<Enable2FAResponse>>('/auth/2fa/enable');
  return data;
}

/**
 * `POST /auth/2fa/verify` — Público (requiere `tempToken` emitido por {@link login}).
 * Completa el login devolviendo los tokens definitivos y el usuario autenticado.
 *
 * @example
 * ```ts
 * const res = await authService.verify2FA({ tempToken, code: '123456' });
 * if (res.valid) saveSession(res.data.accessToken, res.data.refreshToken, res.data.user);
 * ```
 */
async function verify2FA(body: Verify2FARequest): Promise<ApiResponse<LoginResponse>> {
  const { data } = await httpClient.post<ApiResponse<LoginResponse>>('/auth/2fa/verify', body);
  return data;
}

export const authService = {
  login,
  logout,
  refresh,
  forgotPassword,
  resetPassword,
  changePassword,
  enable2FA,
  verify2FA,
};
