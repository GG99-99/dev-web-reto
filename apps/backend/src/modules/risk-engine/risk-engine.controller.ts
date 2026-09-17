import type { Request, Response } from 'express';
import { evaluationsService } from '../evaluations/evaluations.service';
import { riskEngineService } from './risk-engine.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * risk-engine.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 12 de API_CONTRACTS.md (RF-14).
 * ---------------------------------------------------------------------------
 */
export const riskEngineController = {
  getScore: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const evaluation = await evaluationsService.getById(id);
    evaluationsService.assertAccess(evaluation, { userId: req.user.userId, role: req.user.role });
    const data = await riskEngineService.getByEvaluation(id);
    return res.status(200).json(ok(data));
  },

  getRules: async (_req: Request, res: Response) => {
    const data = await riskEngineService.getRules();
    return res.status(200).json(ok(data));
  },

  updateRule: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const body = req.validated!.body;
    const data = await riskEngineService.updateRule(id, body);
    return res.status(200).json(ok(data));
  },
};
