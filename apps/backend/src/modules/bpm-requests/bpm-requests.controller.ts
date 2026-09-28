import type { Request, Response } from 'express';
import { bpmRequestsService } from './bpm-requests.service';
import { dashboardModel } from '../dashboard/dashboard.model';
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

    // COORDINADOR y ADMIN ven todas las solicitudes.
    // Company accounts only see requests for establishments they own or represent.
    let filter = query;
    if (req.user.role === 'ADMIN_EMPRESA' || req.user.role === 'USUARIO_DELEGADO') {
      const ownedIds = req.user.personId
        ? await dashboardModel.getOwnedInstitutionIds(req.user.personId)
        : [];
      const requestedId = query.institutionId as number | undefined;
      const matched = requestedId
        ? ownedIds.filter((id) => id === requestedId)
        : ownedIds;
      const institutionIds = matched.length > 0 ? matched : [-1];
      const { institutionId: _ignored, ...rest } = query;
      filter = { ...rest, institutionIds };
    }

    const data = await bpmRequestsService.getMany(filter);
    return res.status(200).json(ok(data));
  },

  getOne: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const data = await bpmRequestsService.getById(id);
    await bpmRequestsService.assertAccess(data, { userId: req.user.userId, role: req.user.role, personId: req.user.personId });
    return res.status(200).json(ok(data));
  },

  create: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = req.validated!.body;
    const data = await bpmRequestsService.create(
      { userId: req.user.userId, role: req.user.role, personId: req.user.personId },
      body,
    );
    return res.status(201).json(ok(data));
  },

  update: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const body = req.validated!.body;
    const data = await bpmRequestsService.update(id, { userId: req.user.userId, role: req.user.role, personId: req.user.personId }, body);
    return res.status(200).json(ok(data));
  },

  addAttachment: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!req.file) throw ApiError.validation('The file ("file") is required');
    const { id } = req.validated!.params;
    const data = await bpmRequestsService.addAttachment(id, { userId: req.user.userId, role: req.user.role, personId: req.user.personId }, req.file);
    return res.status(201).json(ok(data));
  },

  submit: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const data = await bpmRequestsService.submit(id, { userId: req.user.userId, role: req.user.role, personId: req.user.personId });
    return res.status(200).json(ok(data));
  },
};
