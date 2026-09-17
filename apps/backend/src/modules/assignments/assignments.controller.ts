import type { Request, Response } from 'express';
import { assignmentsService } from './assignments.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

export const assignmentsController = {
  getMany: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const data = await assignmentsService.getMany(id);
    return res.status(200).json(ok(data));
  },

  assign: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const body = req.validated!.body;
    const data = await assignmentsService.assign(id, req.user.userId, body);
    return res.status(201).json(ok(data));
  },

  reassign: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const body = req.validated!.body;
    const data = await assignmentsService.reassign(id, req.user.userId, body);
    return res.status(201).json(ok(data));
  },
};
