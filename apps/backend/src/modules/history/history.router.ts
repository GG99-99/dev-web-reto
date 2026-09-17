import { Router } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { historyController } from './history.controller';
import { HistorySearchQuerySchema } from './history.schemas';

/**
 * history.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /history (montado bajo /api/v1). Sección 15 de
 * API_CONTRACTS.md (RF-20). El scope a la propia empresa para
 * ADMIN_EMPRESA se resuelve dentro de history.service.ts (no es
 * expresable con validateRole).
 * ---------------------------------------------------------------------------
 */
export const historyRouter = Router();

historyRouter
  .use(validateJwt, validateRole('COORDINADOR', 'ADMIN', 'ADMIN_EMPRESA'))
  .get('/history/search', validateReq(HistorySearchQuerySchema, 'query'), historyController.search);
