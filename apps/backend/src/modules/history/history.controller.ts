import type { Request, Response } from 'express';
import { historyService } from './history.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * history.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 15 de API_CONTRACTS.md (RF-20).
 * ---------------------------------------------------------------------------
 */
export const historyController = {
  search: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const query = req.validated!.query;
    const data = await historyService.search(query, { personId: req.user.personId, role: req.user.role });
    return res.status(200).json(ok(data));
  },
};
