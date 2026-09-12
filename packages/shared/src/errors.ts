/**
 * errors.ts
 * ---------------------------------------------------------------------------
 * Mapa de errores estándar (sección 18 de API_CONTRACTS.md).
 * Toda fila de la tabla original corresponde a un `ApiErrorResponse`
 * (`valid: false`) con ese `error.code`. Ver `common.ts` para el envoltorio.
 * ---------------------------------------------------------------------------
 */

/**
 * Códigos de error estables devueltos en `ApiErrorResponse.error.code`.
 * Útil para hacer `switch`/mapeo a mensajes traducidos en el frontend sin
 * depender de comparar el `message` en texto libre.
 *
 * | Código             | HTTP | Cuándo                                                              |
 * |--------------------|------|----------------------------------------------------------------------|
 * | `VALIDATION_ERROR` | 400  | Body/query no cumple el schema (zod/class-validator).                |
 * | `UNAUTHORIZED`     | 401  | Token ausente o inválido.                                            |
 * | `FORBIDDEN`        | 403  | Rol sin permiso, o recurso bloqueado (`locked`, status no editable). |
 * | `NOT_FOUND`        | 404  | Id inexistente.                                                      |
 * | `CONFLICT`         | 409  | Duplicado (RNC, `numeroAlerta`, etc.) o transición de estado inválida. |
 * | `INTERNAL_ERROR`   | 500  | No controlado.                                                       |
 *
 * @example
 * ```ts
 * function handleError(res: ApiErrorResponse) {
 *   switch (res.error.code as ApiErrorCode) {
 *     case 'UNAUTHORIZED':
 *       redirectToLogin();
 *       break;
 *     case 'VALIDATION_ERROR':
 *       showFieldErrors(res.error.details);
 *       break;
 *     default:
 *       toast.error(res.error.message);
 *   }
 * }
 * ```
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';
