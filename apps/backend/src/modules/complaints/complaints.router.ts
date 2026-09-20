import { Router, type Router as ExpressRouter } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { complaintsController } from './complaints.controller';
import { GetComplaintsQuerySchema, CreateComplaintSchema, SetComplaintResultSchema, IdParamSchema } from './complaints.schemas';

/**
 * complaints.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /complaints (montado bajo /api/v1). Sección 9 de
 * API_CONTRACTS.md (RF-09). POST /complaints es PÚBLICO (formulario de
 * denuncia ciudadana); el resto requiere COORDINADOR/ADMIN.
 * ---------------------------------------------------------------------------
 */
export const complaintsRouter: ExpressRouter = Router();

complaintsRouter
  .post('/complaints', validateReq(CreateComplaintSchema, 'body'), complaintsController.create)

  .use('/complaints', validateJwt, validateRole('COORDINADOR', 'ADMIN'))
  .get('/complaints', validateReq(GetComplaintsQuerySchema, 'query'), complaintsController.getMany)
  .get('/complaints/:id', validateReq(IdParamSchema, 'params'), complaintsController.getOne)
  .patch(
    '/complaints/:id/resultado',
    validateReq(IdParamSchema, 'params'),
    validateReq(SetComplaintResultSchema, 'body'),
    complaintsController.setResultado,
  )
  .post('/complaints/:id/generate-case', validateReq(IdParamSchema, 'params'), complaintsController.generateCase);
