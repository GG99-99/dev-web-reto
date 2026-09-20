export declare function setAccessTokenProvider(provider: () => string | null | undefined): void;
export declare function setOnTokenRefreshed(cb: (accessToken: string, refreshToken: string) => void): void;
export declare function setOnSessionExpired(cb: () => void): void;
export declare function setRefreshTokenProvider(provider: () => string | null | undefined): void;
/**
 * Cliente axios base. `baseURL` apunta al API versionado (sección 0 de
 * API_CONTRACTS.md). Ajusta `VITE_API_URL` / `NEXT_PUBLIC_API_URL` según tu
 * bundler.
 */
export declare const httpClient: import("axios").AxiosInstance;
export default httpClient;
