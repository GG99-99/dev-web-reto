import type { Request, Response } from 'express';
import { institutionsService } from './institutions.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * institutions.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 3 de API_CONTRACTS.md (RF-03).
 * ---------------------------------------------------------------------------
 */
export const institutionsController = {
  getMany: async (req: Request, res: Response) => {
    const query = req.validated!.query;
    const data = await institutionsService.getMany(query);
    return res.status(200).json(ok(data));
  },

  getOne: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    await institutionsService.assertAccess(req.user.personId, req.user.role, id);
    const data = await institutionsService.getById(id);
    return res.status(200).json(ok(data));
  },

  getHistory: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    await institutionsService.assertAccess(req.user.personId, req.user.role, id);
    const data = await institutionsService.getHistory(id);
    return res.status(200).json(ok(data));
  },

  getEvaluations: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    await institutionsService.assertAccess(req.user.personId, req.user.role, id);
    const data = await institutionsService.getEvaluations(id);
    return res.status(200).json(ok(data));
  },

  create: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = req.validated!.body;
    const data = await institutionsService.create(req.user.personId, body);
    return res.status(201).json(ok(data));
  },

  update: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    await institutionsService.assertAccess(req.user.personId, req.user.role, id);
    const body = req.validated!.body;
    const data = await institutionsService.update(id, body);
    return res.status(200).json(ok(data));
  },

  addRepresentative: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    await institutionsService.assertAccess(req.user.personId, req.user.role, id);
    const body = req.validated!.body;
    const data = await institutionsService.addRepresentative(id, body);
    return res.status(201).json(ok(data));
  },

  updateRepresentative: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params; // representId
    const body = req.validated!.body;
    const data = await institutionsService.updateRepresentative(id, body, {
      personId: req.user.personId,
      role: req.user.role,
    });
    return res.status(200).json(ok(data));
  },

  removeRepresentative: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params; // representId
    const data = await institutionsService.removeRepresentative(id, {
      personId: req.user.personId,
      role: req.user.role,
    });
    return res.status(200).json(ok(data));
  },
};
