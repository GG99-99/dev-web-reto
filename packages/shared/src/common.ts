/**
 * common.ts
 * ---------------------------------------------------------------------------
 * Tipos base compartidos por TODOS los endpoints del sistema EBR/BPM.
 * Corresponde a la sección "0. Convenciones generales" de API_CONTRACTS.md.
 *
 * Estos tipos no representan una entidad de negocio puntual, sino el
 * "envoltorio" (wrapper) estándar de request/response usado por el resto
 * de los módulos (auth, users, institutions, cases, etc.).
 * ---------------------------------------------------------------------------
 */

/**
 * Envoltorio estándar de toda respuesta EXITOSA (HTTP 2xx).
 *
 * @typeParam T - Forma del payload real de la respuesta (ej. `User`, `Case[]`).
 *
 * @example
 * ```ts
 * async function getUser(id: number): Promise<ApiSuccessResponse<UserWithPerson>> {
 *   const res = await fetch(`/api/v1/users/${id}`);
 *   return res.json();
 * }
 * ```
 */
export interface ApiSuccessResponse<T> {
  /** Siempre `true` cuando la operación fue exitosa. Sirve como discriminante del union. */
  valid: true;
  /** Payload de la respuesta, tipado según el endpoint. */
  data: T;
  /** Nunca presente en una respuesta exitosa (usado solo para narrowing de TS). */
  error?: never;
}

/**
 * Envoltorio estándar de toda respuesta con ERROR (HTTP 4xx/5xx).
 *
 * @example
 * ```ts
 * const res: ApiErrorResponse = {
 *   valid: false,
 *   error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' },
 * };
 * ```
 */
export interface ApiErrorResponse {
  /** Siempre `false` cuando la operación falló. Sirve como discriminante del union. */
  valid: false;
  /** Nunca presente en una respuesta con error (usado solo para narrowing de TS). */
  data?: never;
  error: ApiError;
}

export interface ApiError{
    code: string;
    /** Mensaje legible para mostrar al usuario o loguear. */
    message: string;
    /** Detalle adicional libre (ej. errores de validación campo por campo). */
    details?: unknown;
}

/**
 * Discriminated union que representa la respuesta de CUALQUIER endpoint del API.
 * Permite hacer narrowing sin castear:
 *
 * @example
 * ```ts
 * const res: ApiResponse<Institution> = await api.get(`/institutions/${id}`);
 * if (res.valid) {
 *   console.log(res.data.name); // res.data está tipado como Institution
 * } else {
 *   console.error(res.error.code, res.error.message);
 * }
 * ```
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Query params comunes a todos los endpoints de listado (`GET /recursos`).
 *
 * @example
 * ```ts
 * const query: PaginationQuery = { page: 1, pageSize: 20, sortBy: 'createdAt', sortDir: 'desc' };
 * const qs = new URLSearchParams(query as Record<string, string>).toString();
 * ```
 */
export interface PaginationQuery {
  /** Número de página, base 1. Default: 1. */
  page?: number;
  /** Cantidad de items por página. Default: 20, máximo: 100. */
  pageSize?: number;
  /** Campo por el cual ordenar (nombre de columna del recurso). */
  sortBy?: string;
  /** Dirección del orden. */
  sortDir?: 'asc' | 'desc';
}

/**
 * Forma estándar de una respuesta paginada, usada dentro de `ApiResponse<T>`.
 *
 * @typeParam T - Tipo de cada elemento de la lista.
 *
 * @example
 * ```ts
 * type ListCasesResponse = ApiResponse<PaginatedResponse<Case>>;
 * ```
 */
export interface PaginatedResponse<T> {
  /** Elementos de la página actual. */
  items: T[];
  /** Página actual devuelta. */
  page: number;
  /** Tamaño de página usado. */
  pageSize: number;
  /** Total de elementos que cumplen el filtro (todas las páginas). */
  total: number;
  /** Total de páginas disponibles = ceil(total / pageSize). */
  totalPages: number;
}

/**
 * Roles del sistema (tabla `role`, RF-02). Se usa en guards de autorización
 * en el backend y para condicionar la UI en el frontend.
 */
export type UserRole =
  | 'ADMIN'
  | 'ADMIN_EMPRESA'
  | 'USUARIO_DELEGADO'
  | 'COORDINADOR'
  | 'TECNICO_EVALUADOR';
