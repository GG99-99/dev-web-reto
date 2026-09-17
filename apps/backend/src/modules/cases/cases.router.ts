import { Router } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { casesController } from './cases.controller';
import {
  GetCasesQuerySchema,
  CreateInstitutionalCaseSchema,
  UpdateCasePrioritySchema,
  CloseCaseSchema,
  IdParamSchema,
} from './cases.schemas';

/**
 * cases.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /cases (montado bajo /api/v1). Sección 6 de API_CONTRACTS.md
 * (RF-06, RF-19).
 * ---------------------------------------------------------------------------
 */
export const casesRouter = Router();

casesRouter
  .use(validateJwt)
  .get('/cases', validateRole('COORDINADOR', 'ADMIN'), validateReq(GetCasesQuerySchema, 'query'), casesController.getMany)
  .post(
    '/cases',
    validateRole('COORDINADOR'),
    validateReq(CreateInstitutionalCaseSchema, 'body'),
    casesController.create,
  )
  .get('/cases/:id', validateReq(IdParamSchema, 'params'), casesController.getOne) // acceso fino en el controller
  .get('/cases/:id/close/pdf', validateReq(IdParamSchema, 'params'), casesController.downloadOfficialPdf)
  .patch(
    '/cases/:id/priority',
    validateRole('COORDINADOR'),
    validateReq(IdParamSchema, 'params'),
    validateReq(UpdateCasePrioritySchema, 'body'),
    casesController.updatePriority,
  )
  .post(
    '/cases/:id/close',
    validateRole('COORDINADOR'),
    validateReq(IdParamSchema, 'params'),
    validateReq(CloseCaseSchema, 'body'),
    casesController.close,
  );
