import type { Request, Response } from 'express';
import { evidencesService } from './evidences.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * evidences.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 13 de API_CONTRACTS.md (RF-15).
 * ---------------------------------------------------------------------------
 */
export const evidencesController = {
  getMany: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const data = await evidencesService.getMany(id, { userId: req.user.userId, role: req.user.role });
    return res.status(200).json(ok(data));
  },

  create: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!req.file) throw ApiError.validation('El archivo ("file") es requerido');
    const { id } = req.validated!.params;
    const body = req.validated!.body;
    const data = await evidencesService.create(id, req.user.userId, req.file, body);
    return res.status(201).json(ok(data));
  },

  remove: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params; // evidenceId
    const data = await evidencesService.remove(id, req.user.userId, req.user.role);
    return res.status(200).json(ok(data));
  },
};
