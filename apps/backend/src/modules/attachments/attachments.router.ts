import { Router } from 'express';
import { validateJwt, validateReq } from '#backend/middlewares';
import { uploadSingleFile } from '@/lib/upload/upload';
import { attachmentsController } from './attachments.controller';
import { UploadAttachmentBodySchema } from './attachments.schemas';
import { IdParamSchema } from '@/lib/common/schemas';

/**
 * attachments.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /attachments (montado bajo /api/v1). Sección 17 de
 * API_CONTRACTS.md. `uploadSingleFile` (multer) corre ANTES de `validateReq`
 * porque es quien parsea el `multipart/form-data` y llena `req.body`/`req.file`.
 * ---------------------------------------------------------------------------
 */
export const attachmentsRouter = Router();

attachmentsRouter
  .use(validateJwt)
  .post('/attachments', uploadSingleFile, validateReq(UploadAttachmentBodySchema, 'body'), attachmentsController.create)
  .get('/attachments/:id', validateReq(IdParamSchema, 'params'), attachmentsController.getOne)
  .delete('/attachments/:id', validateReq(IdParamSchema, 'params'), attachmentsController.remove);
