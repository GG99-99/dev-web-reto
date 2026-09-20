import { Router, type Router as ExpressRouter } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { uploadSingleFile } from '@/lib/upload/upload';
import { bpmRequestsController } from './bpm-requests.controller';
import { GetBpmRequestsQuerySchema, CreateBpmRequestSchema, UpdateBpmRequestSchema, IdParamSchema } from './bpm-requests.schemas';

/**
 * bpm-requests.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /bpm-requests (montado bajo /api/v1). Sección 5 de
 * API_CONTRACTS.md (RF-05).
 * ---------------------------------------------------------------------------
 */
export const bpmRequestsRouter: ExpressRouter = Router();

bpmRequestsRouter
  .use('/bpm-requests', validateJwt)
  .get(
    '/bpm-requests',
    validateRole('ADMIN_EMPRESA', 'USUARIO_DELEGADO', 'COORDINADOR', 'ADMIN'),
    validateReq(GetBpmRequestsQuerySchema, 'query'),
    bpmRequestsController.getMany,
  )
  .get('/bpm-requests/:id', validateReq(IdParamSchema, 'params'), bpmRequestsController.getOne) // acceso fino en el controller
  .post(
    '/bpm-requests',
    validateRole('ADMIN_EMPRESA', 'USUARIO_DELEGADO'),
    validateReq(CreateBpmRequestSchema, 'body'),
    bpmRequestsController.create,
  )
  .patch(
    '/bpm-requests/:id',
    validateReq(IdParamSchema, 'params'),
    validateReq(UpdateBpmRequestSchema, 'body'),
    bpmRequestsController.update,
  ) // "solo el autor" se valida en el service
  .post(
    '/bpm-requests/:id/attachments',
    validateReq(IdParamSchema, 'params'),
    uploadSingleFile,
    bpmRequestsController.addAttachment,
  )
  .post('/bpm-requests/:id/submit', validateReq(IdParamSchema, 'params'), bpmRequestsController.submit);
