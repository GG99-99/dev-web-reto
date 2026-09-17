import { Router } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { reportsController } from './reports.controller';
import { ReviewReportSchema, CorrectReportSchema, IdParamSchema } from './reports.schemas';

/**
 * reports.router.ts
 * ---------------------------------------------------------------------------
 * Base paths: /evaluations/:id/report, /reports/:id/... (montado bajo
 * /api/v1). Sección 14 de API_CONTRACTS.md (RF-16, RF-17, RF-18).
 * ---------------------------------------------------------------------------
 */
export const reportsRouter = Router();

reportsRouter
  .use(validateJwt)
  .get('/evaluations/:id/report', validateReq(IdParamSchema, 'params'), reportsController.getByEvaluation)
  .post('/reports/:id/submit', validateReq(IdParamSchema, 'params'), reportsController.submit)
  .post(
    '/reports/:id/review',
    validateRole('COORDINADOR', 'ADMIN'),
    validateReq(IdParamSchema, 'params'),
    validateReq(ReviewReportSchema, 'body'),
    reportsController.review,
  )
  .get('/reports/:id/reviews', validateReq(IdParamSchema, 'params'), reportsController.getReviews)
  .post(
    '/reports/:id/correct',
    validateReq(IdParamSchema, 'params'),
    validateReq(CorrectReportSchema, 'body'),
    reportsController.correct,
  )
  .post('/reports/:id/resend', validateReq(IdParamSchema, 'params'), reportsController.resend);
