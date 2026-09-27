import type { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '@/lib/common/ApiError';

type Source = 'body' | 'params' | 'query';

/**
 * Valida `req[source]` contra un schema zod y lo deja parseado/tipado en
 * `req.validated[source]`. Los controllers SIEMPRE deben leer de ahí, nunca
 * de `req.body`/`req.query`/`req.params` directamente.
 */
export function validateReq(schema: z.ZodTypeAny, source: Source = 'body') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const result = await schema.safeParseAsync(req[source]);

    if (!result.success) {
      const flat = result.error.flatten();
      const fieldMessages = Object.entries(flat.fieldErrors).flatMap(([field, messages]) => {
        const list = Array.isArray(messages) ? messages : [];
        return list.map((message) => `${field}: ${message}`);
      });
      const parts = [...flat.formErrors, ...fieldMessages].filter(Boolean);
      throw ApiError.validation(parts.length > 0 ? parts.join('; ') : 'Validation error', flat);
    }

    if (!req.validated) req.validated = {};
    req.validated[source] = result.data;
    next();
  };
}
