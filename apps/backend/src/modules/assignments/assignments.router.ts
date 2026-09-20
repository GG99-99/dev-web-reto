import { Router, type Router as ExpressRouter } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { assignmentsController } from './assignments.controller';
import { AssignTechnicianSchema } from './assignments.schemas';
import { IdParamSchema } from '@/lib/common/schemas';

/**
 * assignments.router.ts
 * ---------------------------------------------------------------------------
 * Rutas anidadas bajo /cases/:id/... (montado bajo /api/v1). Sección 10 de
 * API_CONTRACTS.md (RF-10). Todo el módulo es exclusivo de COORDINADOR.
 * ---------------------------------------------------------------------------
 */
export const assignmentsRouter: ExpressRouter = Router();

assignmentsRouter
  .use('/cases', validateJwt, validateRole('COORDINADOR', 'ADMIN'))
  .get('/cases/:id/assignments', validateReq(IdParamSchema, 'params'), assignmentsController.getMany)
  .post(
    '/cases/:id/assign',
    validateReq(IdParamSchema, 'params'),
    validateReq(AssignTechnicianSchema, 'body'),
    assignmentsController.assign,
  )
  .post(
    '/cases/:id/reassign',
    validateReq(IdParamSchema, 'params'),
    validateReq(AssignTechnicianSchema, 'body'),
    assignmentsController.reassign,
  );
