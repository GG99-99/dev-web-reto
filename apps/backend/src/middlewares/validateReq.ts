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
      throw ApiError.validation('Validation error', result.error.flatten());
    }

    if (!req.validated) req.validated = {};
    req.validated[source] = result.data;
    next();
  };
}
