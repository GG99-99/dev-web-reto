import { Router } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { uploadSingleFile } from '@/lib/upload/upload';
import { evidencesController } from './evidences.controller';
import { CreateEvidenceBodySchema, IdParamSchema } from './evidences.schemas';

/**
 * evidences.router.ts
 * ---------------------------------------------------------------------------
 * Base paths: /evaluations/:id/evidences, /evidences/:id (montado bajo
 * /api/v1). Sección 13 de API_CONTRACTS.md (RF-15).
 * ---------------------------------------------------------------------------
 */
export const evidencesRouter = Router();

evidencesRouter
  .use(validateJwt)
  .get('/evaluations/:id/evidences', validateReq(IdParamSchema, 'params'), evidencesController.getMany)
  .post(
    '/evaluations/:id/evidences',
    validateRole('TECNICO_EVALUADOR'),
    validateReq(IdParamSchema, 'params'),
    uploadSingleFile,
    validateReq(CreateEvidenceBodySchema, 'body'),
    evidencesController.create,
  )
  .delete('/evidences/:id', validateReq(IdParamSchema, 'params'), evidencesController.remove);
