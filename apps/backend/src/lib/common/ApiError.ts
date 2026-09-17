import type { ApiErrorCode } from '@reto/shared';

/**
 * ApiError.ts
 * ---------------------------------------------------------------------------
 * Error runtime estándar del backend. Mapea 1:1 con la tabla de la sección
 * 18 de API_CONTRACTS.md (`ApiErrorCode` -> HTTP status). Se lanza desde
 * cualquier capa (model/service/controller) y lo captura `errorHandler`.
 * ---------------------------------------------------------------------------
 */

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  code: ApiErrorCode;
  statusCode: number;
  details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.details = details;
  }

  static validation(message: string, details?: unknown) {
    return new ApiError('VALIDATION_ERROR', message, details);
  }
  static unauthorized(message = 'No autenticado') {
    return new ApiError('UNAUTHORIZED', message);
  }
  static forbidden(message = 'No tienes permiso para esta acción') {
    return new ApiError('FORBIDDEN', message);
  }
  static notFound(message = 'Recurso no encontrado') {
    return new ApiError('NOT_FOUND', message);
  }
  static conflict(message: string, details?: unknown) {
    return new ApiError('CONFLICT', message, details);
  }
  static internal(message = 'Error interno del servidor') {
    return new ApiError('INTERNAL_ERROR', message);
  }
}
