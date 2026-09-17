import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@reto/shared';
import { ApiError } from '@/lib/common/ApiError';

/**
 * RBAC simple por rol (RNF-02). Debe usarse siempre DESPUÉS de `validateJwt`.
 *
 * @example
 * ```ts
 * router.get('/users', validateJwt, validateRole('ADMIN'), usersController.getMany)
 * ```
 */
export function validateRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!req.user.role || !roles.includes(req.user.role)) {
      throw ApiError.forbidden();
    }
    next();
  };
}
