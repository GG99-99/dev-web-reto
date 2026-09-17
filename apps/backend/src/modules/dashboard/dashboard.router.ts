import { Router } from 'express';
import { validateJwt, validateRole } from '#backend/middlewares';
import { dashboardController } from './dashboard.controller';

/**
 * dashboard.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /dashboard (montado bajo /api/v1). Sección 4 de
 * API_CONTRACTS.md (RF-04).
 * ---------------------------------------------------------------------------
 */
export const dashboardRouter = Router();

dashboardRouter
  .use(validateJwt)
  .get('/dashboard/empresa', validateRole('ADMIN_EMPRESA', 'USUARIO_DELEGADO'), dashboardController.getEmpresa)
  .get('/dashboard/coordinador', validateRole('COORDINADOR', 'ADMIN'), dashboardController.getCoordinador)
  .get('/dashboard/tecnico', validateRole('TECNICO_EVALUADOR'), dashboardController.getTecnico);
