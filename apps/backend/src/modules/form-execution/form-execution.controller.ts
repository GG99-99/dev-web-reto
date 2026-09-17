import type { Request, Response } from 'express';
import { formExecutionService } from './form-execution.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * form-execution.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 11 de API_CONTRACTS.md (RF-12, RF-13).
 * ---------------------------------------------------------------------------
 */
export const formExecutionController = {
  getTemplates: async (_req: Request, res: Response) => {
    const data = await formExecutionService.getTemplates();
    return res.status(200).json(ok(data));
  },

  getTemplateTree: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const data = await formExecutionService.getTemplateTree(id);
    return res.status(200).json(ok(data));
  },

  start: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const body = req.validated!.body;
    const data = await formExecutionService.start(id, req.user.userId, body);
    return res.status(200).json(ok(data));
  },

  saveAnswers: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const { answers } = req.validated!.body;
    const data = await formExecutionService.saveAnswers(id, req.user.userId, answers);
    return res.status(200).json(ok(data));
  },

  finish: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const data = await formExecutionService.finish(id, req.user.userId);
    return res.status(200).json(ok(data));
  },
};
