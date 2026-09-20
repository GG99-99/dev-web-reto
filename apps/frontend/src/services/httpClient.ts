/**
 * httpClient.ts
 * ---------------------------------------------------------------------------
 * Instancia de axios compartida por TODOS los servicios del sistema EBR/BPM.
 *
 * Centraliza:
 *  - `baseURL` del API (`/api/v1`, sección 0 de API_CONTRACTS.md).
 *  - Inyección del header `Authorization: Bearer <accessToken>` (RNF-02).
 *  - Refresco automático del `accessToken` cuando el backend responde 401
 *    con código `UNAUTHORIZED` (usa `POST /auth/refresh`).
 *
 * El resto de los archivos `*.service.ts` importan `httpClient` y NO deben
 * crear su propia instancia de axios.
 * ---------------------------------------------------------------------------
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorResponse } from '@reto/shared';

/**
 * Provee el `accessToken` vigente. Se inyecta desde la capa de auth de la
 * app (store, contexto, etc.) para no acoplar este archivo a ninguna
 * librería de estado en particular.
 *
 * @example
 * ```ts
 * import { setAccessTokenProvider } from '@/services/httpClient';
 * setAccessTokenProvider(() => authStore.getState().accessToken);
 * ```
 */
let getAccessToken: () => string | null | undefined = () => null;
export function setAccessTokenProvider(provider: () => string | null | undefined): void {
  getAccessToken = provider;
}

/**
 * Se invoca cuando `POST /auth/refresh` fue exitoso, para persistir el
 * nuevo par de tokens en el store de auth de la app.
 *
 * @example
 * ```ts
 * import { setOnTokenRefreshed } from '@/services/httpClient';
 * setOnTokenRefreshed((accessToken, refreshToken) => authStore.getState().setTokens(accessToken, refreshToken));
 * ```
 */
let onTokenRefreshed: (accessToken: string, refreshToken: string) => void = () => undefined;
export function setOnTokenRefreshed(
  cb: (accessToken: string, refreshToken: string) => void,
): void {
  onTokenRefreshed = cb;
}

/** Se invoca cuando el refresh también falla: la sesión debe cerrarse. */
let onSessionExpired: () => void = () => undefined;
export function setOnSessionExpired(cb: () => void): void {
  onSessionExpired = cb;
}

/** Provee el `refreshToken` vigente, usado para renovar el `accessToken`. */
let getRefreshToken: () => string | null | undefined = () => null;
export function setRefreshTokenProvider(provider: () => string | null | undefined): void {
  getRefreshToken = provider;
}

/**
 * Cliente axios base. `baseURL` apunta al API versionado (sección 0 de
 * API_CONTRACTS.md). Ajusta `VITE_API_URL` / `NEXT_PUBLIC_API_URL` según tu
 * bundler.
 */
export const httpClient = axios.create({
  // Express mounts the versioned API router at `/api/v1`.
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

let refreshInFlight: Promise<string> | null = null;

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const isUnauthorized =
      error.response?.status === 401 && error.response.data?.error?.code === 'UNAUTHORIZED';

    // Evita loop infinito y no intenta refrescar la llamada de refresh en sí misma.
    if (!isUnauthorized || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }
    if (originalRequest.url?.includes('/auth/refresh')) {
      onSessionExpired();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshInFlight) {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw error;

        refreshInFlight = httpClient
          .post('/auth/refresh', { refreshToken })
          .then((res) => {
            const { accessToken, refreshToken: newRefreshToken } = res.data.data;
            onTokenRefreshed(accessToken, newRefreshToken);
            return accessToken as string;
          })
          .finally(() => {
            refreshInFlight = null;
          });
      }

      const newAccessToken = await refreshInFlight;
      originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
      return httpClient(originalRequest);
    } catch (refreshError) {
      onSessionExpired();
      return Promise.reject(refreshError);
    }
  },
);

export default httpClient;
