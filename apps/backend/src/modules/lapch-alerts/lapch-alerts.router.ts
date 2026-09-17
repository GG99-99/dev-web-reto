import { Router } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { lapchAlertsController } from './lapch-alerts.controller';
import {
  GetLapchAlertsQuerySchema,
  CreateLapchAlertSchema,
  SetLapchResultSchema,
  IdParamSchema,
} from './lapch-alerts.schemas';

/**
 * lapch-alerts.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /lapch-alerts (montado bajo /api/v1). Sección 8 de
 * API_CONTRACTS.md (RF-08).
 * ---------------------------------------------------------------------------
 */
export const lapchAlertsRouter = Router();

lapchAlertsRouter
  .use(validateJwt, validateRole('COORDINADOR', 'ADMIN'))
  .get('/lapch-alerts', validateReq(GetLapchAlertsQuerySchema, 'query'), lapchAlertsController.getMany)
  .post('/lapch-alerts', validateReq(CreateLapchAlertSchema, 'body'), lapchAlertsController.create)
  .get('/lapch-alerts/:id', validateReq(IdParamSchema, 'params'), lapchAlertsController.getOne)
  .patch(
    '/lapch-alerts/:id/resultado',
    validateReq(IdParamSchema, 'params'),
    validateReq(SetLapchResultSchema, 'body'),
    lapchAlertsController.setResultado,
  )
  .post('/lapch-alerts/:id/generate-case', validateReq(IdParamSchema, 'params'), lapchAlertsController.generateCase)
  .post('/lapch-alerts/:id/close', validateReq(IdParamSchema, 'params'), lapchAlertsController.close);
