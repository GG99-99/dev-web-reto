import type { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

export const dashboardController = {
  getEmpresa: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await dashboardService.getEmpresa(req.user.personId, req.user.userId);
    return res.status(200).json(ok(data));
  },

  getCoordinador: async (_req: Request, res: Response) => {
    const data = await dashboardService.getCoordinador();
    return res.status(200).json(ok(data));
  },

  getTecnico: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await dashboardService.getTecnico(req.user.userId);
    return res.status(200).json(ok(data));
  },
};
