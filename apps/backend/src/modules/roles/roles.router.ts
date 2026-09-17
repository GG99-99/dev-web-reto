import { Router } from 'express';
import { validateJwt, validateRole } from '#backend/middlewares';
import { rolesController } from './roles.controller';

/**
 * roles.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /roles (montado bajo /api/v1). Sección 2 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */
export const rolesRouter = Router();

rolesRouter.get('/roles', validateJwt, validateRole('ADMIN'), rolesController.getMany);
