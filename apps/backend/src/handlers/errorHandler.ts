import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
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
function isMalformedJson(err: unknown): boolean {
  if (!(err instanceof SyntaxError)) return false;
  const parsed = err as SyntaxError & { status?: number; statusCode?: number; type?: string };
  return parsed.status === 400
    || parsed.statusCode === 400
    || parsed.type === 'entity.parse.failed'
    || /json/i.test(err.message);
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (isMalformedJson(err)) {
    const response: ApiErrorResponse = {
      valid: false,
      error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' },
    };
    return res.status(400).json(response);
  }

  // Error de negocio ya tipado (lanzado desde model/service/controller/middleware)
  if (err instanceof ApiError) {
    const response: ApiErrorResponse = {
      valid: false,
      error: { code: err.code, message: err.message, details: err.details },
    };
    return res.status(err.statusCode).json(response);
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File exceeds the 25MB size limit'
      : err.message;
    const response: ApiErrorResponse = {
      valid: false,
      error: { code: 'VALIDATION_ERROR', message },
    };
    return res.status(400).json(response);
  }

  // Error de validación zod que se haya escapado sin pasar por validateReq
  if (err instanceof ZodError) {
    const response: ApiErrorResponse = {
      valid: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation error', details: err.flatten() },
    };
    return res.status(400).json(response);
  }

  // Prisma known errors (duplicates, missing FK, record not found)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaErr = err as Prisma.PrismaClientKnownRequestError;
    if (prismaErr.code === 'P2002') {
      const response: ApiErrorResponse = {
        valid: false,
        error: { code: 'CONFLICT', message: 'A record with those unique values already exists', details: prismaErr.meta },
      };
      return res.status(409).json(response);
    }
    if (prismaErr.code === 'P2025') {
      const response: ApiErrorResponse = {
        valid: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found', details: prismaErr.meta },
      };
      return res.status(404).json(response);
    }
  }

  console.error('[errorHandler]', err);
  const response: ApiErrorResponse = {
    valid: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  };
  return res.status(500).json(response);
}
