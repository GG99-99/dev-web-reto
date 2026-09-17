import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@reto/db';
import type { ApiErrorResponse } from '@reto/shared';
import { ApiError } from '@/lib/common/ApiError';

/**
 * errorHandler.ts
 * ---------------------------------------------------------------------------
 * Middleware de error global (Express 5 reenvía automáticamente los rechazos
 * de handlers `async`, no hace falta envolver cada controller). Traduce
 * cualquier excepción al envoltorio `ApiErrorResponse` (sección 18 de
 * API_CONTRACTS.md).
 * ---------------------------------------------------------------------------
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Error de negocio ya tipado (lanzado desde model/service/controller/middleware)
  if (err instanceof ApiError) {
    const response: ApiErrorResponse = {
      valid: false,
      error: { code: err.code, message: err.message, details: err.details },
    };
    return res.status(err.statusCode).json(response);
  }

  // Error de validación zod que se haya escapado sin pasar por validateReq
  if (err instanceof ZodError) {
    const response: ApiErrorResponse = {
      valid: false,
      error: { code: 'VALIDATION_ERROR', message: 'Error de validación', details: err.flatten() },
    };
    return res.status(400).json(response);
  }

  // Errores conocidos de Prisma (duplicados, FK inexistente, registro no encontrado)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const response: ApiErrorResponse = {
        valid: false,
        error: { code: 'CONFLICT', message: 'Ya existe un registro con esos datos únicos', details: err.meta },
      };
      return res.status(409).json(response);
    }
    if (err.code === 'P2025') {
      const response: ApiErrorResponse = {
        valid: false,
        error: { code: 'NOT_FOUND', message: 'Recurso no encontrado', details: err.meta },
      };
      return res.status(404).json(response);
    }
  }

  console.error('[errorHandler]', err);
  const response: ApiErrorResponse = {
    valid: false,
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
  };
  return res.status(500).json(response);
}
