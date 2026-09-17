import type { Request, Response } from 'express';
import { bpmRequestsService } from './bpm-requests.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * bpm-requests.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 5 de API_CONTRACTS.md (RF-05).
 * ---------------------------------------------------------------------------
 */
export const bpmRequestsController = {
  getMany: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const query = req.validated!.query;

    // ADMIN_EMPRESA/USUARIO_DELEGADO solo ven las suyas; COORDINADOR ve todas.
    const filter = req.user.role === 'COORDINADOR' || req.user.role === 'ADMIN'
      ? query
      : { ...query, createdById: req.user.userId };

    const data = await bpmRequestsService.getMany(filter);
    return res.status(200).json(ok(data));
  },

  getOne: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const data = await bpmRequestsService.getById(id);
    bpmRequestsService.assertAccess(data, { userId: req.user.userId, role: req.user.role });
    return res.status(200).json(ok(data));
  },

  create: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = req.validated!.body;
    const data = await bpmRequestsService.create(req.user.userId, body);
    return res.status(201).json(ok(data));
  },

  update: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const body = req.validated!.body;
    const data = await bpmRequestsService.update(id, req.user.userId, body);
    return res.status(200).json(ok(data));
  },

  addAttachment: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!req.file) throw ApiError.validation('El archivo ("file") es requerido');
    const { id } = req.validated!.params;
    const data = await bpmRequestsService.addAttachment(id, req.user.userId, req.file);
    return res.status(201).json(ok(data));
  },

  submit: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const data = await bpmRequestsService.submit(id, req.user.userId);
    return res.status(200).json(ok(data));
  },
};
