import type { Request, Response } from 'express';
import { attachmentsService } from './attachments.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * attachments.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 17 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */
export const attachmentsController = {
  create: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!req.file) throw ApiError.validation('El archivo ("file") es requerido');

    const { category } = req.validated!.body;
    const data = await attachmentsService.create(req.file, category, req.user.userId);
    return res.status(201).json(ok(data));
  },

  getOne: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const data = await attachmentsService.getById(id, { userId: req.user.userId, role: req.user.role });
    return res.status(200).json(ok(data));
  },

  remove: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const data = await attachmentsService.remove(id, { userId: req.user.userId, role: req.user.role });
    return res.status(200).json(ok(data));
  },
};
