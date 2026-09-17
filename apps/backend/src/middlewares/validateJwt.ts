import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '@/lib/common/ApiError';
import { verifyAccessToken } from '@/lib/auth/jwt';

/**
 * Exige `Authorization: Bearer <accessToken>` (0.1 API_CONTRACTS.md).
 * Decodifica el payload y lo deja en `req.user`.
 */
export function validateJwt(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Token de acceso no proporcionado');
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    req.user = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Token inválido o expirado');
  }

  next();
}
