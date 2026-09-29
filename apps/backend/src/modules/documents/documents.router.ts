import { Router, type Router as ExpressRouter } from 'express';
import { validateReq } from '#backend/middlewares';
import { documentsController } from './documents.controller';
import { VerifyDocumentQuerySchema } from './documents.schemas';

/**
 * Public document check. No session: the QR on an official report opens this.
 */
export const documentsRouter: ExpressRouter = Router();

documentsRouter.get(
  '/public/documents/verify',
  validateReq(VerifyDocumentQuerySchema, 'query'),
  documentsController.verify,
);
