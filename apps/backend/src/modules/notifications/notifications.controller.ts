import type { Request, Response } from 'express';
import { notificationsService } from './notifications.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * notifications.controller.ts
 * ---------------------------------------------------------------------------
 * Soporte a RF-04. Endpoints: /notifications, /notifications/:id/read,
 * /notifications/read-all.
 * ---------------------------------------------------------------------------
 */
export const notificationsController = {
  getMany: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const query = req.validated!.query;
    const data = await notificationsService.getMany(req.user.userId, query);
    return res.status(200).json(ok(data));
  },

  markRead: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const data = await notificationsService.markRead(id, req.user.userId);
    return res.status(200).json(ok(data));
  },

  markAllRead: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await notificationsService.markAllRead(req.user.userId);
    return res.status(200).json(ok(null));
  },
};
