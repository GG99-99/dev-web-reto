import type { Request, Response } from 'express';
import { evaluationsService } from './evaluations.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * evaluations.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 7 de API_CONTRACTS.md (RF-07, RF-11).
 * ---------------------------------------------------------------------------
 */
export const evaluationsController = {
  getMany: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const query = req.validated!.query;
    const data = await evaluationsService.getMany(query, { userId: req.user.userId, role: req.user.role });
    return res.status(200).json(ok(data));
  },

  getOne: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const data = await evaluationsService.getById(id);
    evaluationsService.assertAccess(data, { userId: req.user.userId, role: req.user.role });
    return res.status(200).json(ok(data));
  },

  create: async (req: Request, res: Response) => {
    const body = req.validated!.body;
    const data = await evaluationsService.create(body);
    return res.status(201).json(ok(data));
  },

  reschedule: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const body = req.validated!.body;
    const data = await evaluationsService.reschedule(id, body);
    return res.status(200).json(ok(data));
  },

  cancel: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const data = await evaluationsService.cancel(id);
    return res.status(200).json(ok(data));
  },

  getCalendar: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const query = req.validated!.query;
    const data = await evaluationsService.getCalendar(req.user.userId, query);
    return res.status(200).json(ok(data));
  },
};
