import { Router } from 'express';
import { validateJwt, validateReq } from '#backend/middlewares';
import { notificationsController } from './notifications.controller';
import { GetNotificationsQuerySchema, IdParamSchema } from './notifications.schemas';

/**
 * notifications.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /notifications (montado bajo /api/v1). Soporte a RF-04.
 * ---------------------------------------------------------------------------
 */
export const notificationsRouter = Router();

notificationsRouter
  .use(validateJwt)
  .get('/notifications', validateReq(GetNotificationsQuerySchema, 'query'), notificationsController.getMany)
  .patch('/notifications/read-all', notificationsController.markAllRead)
  .patch('/notifications/:id/read', validateReq(IdParamSchema, 'params'), notificationsController.markRead);
