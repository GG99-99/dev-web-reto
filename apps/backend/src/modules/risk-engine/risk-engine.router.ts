import { Router, type Router as ExpressRouter } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { riskEngineController } from './risk-engine.controller';
import { IdParamSchema, UpdateRiskRuleSchema } from './risk-engine.schemas';

/**
 * risk-engine.router.ts
 * ---------------------------------------------------------------------------
 * Sección 12 de API_CONTRACTS.md (RF-14). El cálculo en sí no se expone por
 * API (se dispara internamente al finalizar una evaluación, ver
 * form-execution.service.ts); aquí solo se expone lectura del score y el
 * catálogo de reglas.
 * ---------------------------------------------------------------------------
 */
export const riskEngineRouter: ExpressRouter = Router();

riskEngineRouter
  .use('/evaluations', validateJwt)
  .use('/catalogs', validateJwt)
  .get('/evaluations/:id/score', validateReq(IdParamSchema, 'params'), riskEngineController.getScore)
  .get('/catalogs/risk-frequency-rules', validateRole('ADMIN'), riskEngineController.getRules)
  .patch(
    '/catalogs/risk-frequency-rules/:id',
    validateRole('ADMIN'),
    validateReq(IdParamSchema, 'params'),
    validateReq(UpdateRiskRuleSchema, 'body'),
    riskEngineController.updateRule,
  );
