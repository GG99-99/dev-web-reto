import type { ApiResponse, LoginRequest, LoginResponse, RefreshRequest, RefreshResponse, ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest, Enable2FAResponse, Verify2FARequest } from '@reto/shared';
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
declare function login(body: LoginRequest): Promise<ApiResponse<LoginResponse>>;
/**
 * `POST /auth/logout` — Autenticado. Invalida el `refreshToken` actual en el backend.
 *
 * @example
 * ```ts
 * await authService.logout();
 * clearLocalSession();
 * ```
 */
declare function logout(body: RefreshRequest): Promise<ApiResponse<null>>;
/**
 * `POST /auth/refresh` — Público (requiere `refreshToken` válido).
 *
 * @remarks
 * En el flujo normal de la app no necesitas llamar esto manualmente: el
 * interceptor de `httpClient` ya lo dispara automáticamente ante un 401.
 * Úsalo solo para refrescos explícitos (ej. al iniciar la app).
 */
declare function refresh(body: RefreshRequest): Promise<ApiResponse<RefreshResponse>>;
/**
 * `POST /auth/password/forgot` — Público. Envía un correo con el link/token de recuperación.
 *
 * @example
 * ```ts
 * await authService.forgotPassword({ email: 'ana@empresa.com' });
 * ```
 */
declare function forgotPassword(body: ForgotPasswordRequest): Promise<ApiResponse<null>>;
/**
 * `POST /auth/password/reset` — Público (requiere `token` de `PasswordResetToken`).
 */
declare function resetPassword(body: ResetPasswordRequest): Promise<ApiResponse<null>>;
/**
 * `POST /auth/password/change` — Autenticado (usuario ya logueado cambiando su propia contraseña).
 */
declare function changePassword(body: ChangePasswordRequest): Promise<ApiResponse<null>>;
/**
 * `POST /auth/2fa/enable` — Autenticado. Devuelve el secreto TOTP y el QR a escanear.
 *
 * @example
 * ```ts
 * const res = await authService.enable2FA();
 * if (res.valid) renderQrCode(res.data.qrCodeUrl);
 * ```
 */
declare function enable2FA(): Promise<ApiResponse<Enable2FAResponse>>;
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
declare function verify2FA(body: Verify2FARequest): Promise<ApiResponse<LoginResponse>>;
export declare const authService: {
    login: typeof login;
    logout: typeof logout;
    refresh: typeof refresh;
    forgotPassword: typeof forgotPassword;
    resetPassword: typeof resetPassword;
    changePassword: typeof changePassword;
    enable2FA: typeof enable2FA;
    verify2FA: typeof verify2FA;
};
export {};
