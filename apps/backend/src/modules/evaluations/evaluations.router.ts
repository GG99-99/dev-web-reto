import { Router, type Router as ExpressRouter } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { evaluationsController } from './evaluations.controller';
import {
  GetEvaluationsQuerySchema,
  CreateEvaluationSchema,
  RescheduleEvaluationSchema,
  CalendarQuerySchema,
  IdParamSchema,
} from './evaluations.schemas';

/**
 * evaluations.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /evaluations (montado bajo /api/v1). Sección 7 de
 * API_CONTRACTS.md (RF-07, RF-11).
 *
 * IMPORTANTE: "/evaluations/calendar" debe registrarse ANTES que
 * "/evaluations/:id", o Express intentaría matchear "calendar" como el
 * parámetro :id.
 * ---------------------------------------------------------------------------
 */
export const evaluationsRouter: ExpressRouter = Router();

evaluationsRouter
  .use('/evaluations', validateJwt)
  .get(
    '/evaluations/calendar',
    validateRole('TECNICO_EVALUADOR'),
    validateReq(CalendarQuerySchema, 'query'),
    evaluationsController.getCalendar,
  )
  .get(
    '/evaluations',
    validateRole('COORDINADOR', 'TECNICO_EVALUADOR', 'ADMIN'),
    validateReq(GetEvaluationsQuerySchema, 'query'),
    evaluationsController.getMany,
  )
  .post(
    '/evaluations',
    validateRole('COORDINADOR'),
    validateReq(CreateEvaluationSchema, 'body'),
    evaluationsController.create,
  )
  .get('/evaluations/:id', validateReq(IdParamSchema, 'params'), evaluationsController.getOne) // acceso fino en el controller
  .patch(
    '/evaluations/:id/reschedule',
    validateRole('COORDINADOR'),
    validateReq(IdParamSchema, 'params'),
    validateReq(RescheduleEvaluationSchema, 'body'),
    evaluationsController.reschedule,
  )
  .post(
    '/evaluations/:id/cancel',
    validateRole('COORDINADOR'),
    validateReq(IdParamSchema, 'params'),
    evaluationsController.cancel,
  );
