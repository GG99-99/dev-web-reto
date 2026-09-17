import type { Request, Response } from 'express';
import { casesService } from './cases.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * cases.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 6 de API_CONTRACTS.md (RF-06, RF-19).
 * ---------------------------------------------------------------------------
 */
export const casesController = {
  getMany: async (req: Request, res: Response) => {
    const query = req.validated!.query;
    const data = await casesService.getMany(query);
    return res.status(200).json(ok(data));
  },

  getOne: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const data = await casesService.getById(id);
    casesService.assertAccess(data, { userId: req.user.userId, role: req.user.role });
    return res.status(200).json(ok(data));
  },

  create: async (req: Request, res: Response) => {
    const body = req.validated!.body;
    const data = await casesService.create(body);
    return res.status(201).json(ok(data));
  },

  updatePriority: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const { priority } = req.validated!.body;
    const data = await casesService.updatePriority(id, priority);
    return res.status(200).json(ok(data));
  },

  close: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const { resultadoFinal, emitirInforme } = req.validated!.body;
    const data = await casesService.close(id, req.user.userId, resultadoFinal, emitirInforme);
    return res.status(200).json(ok(data));
  },

  downloadOfficialPdf: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params;
    const caseDetail = await casesService.getById(id);
    await casesService.assertCanDownloadOfficialReport(caseDetail, { personId: req.user.personId, role: req.user.role });
    const attachment = await casesService.getOfficialReportAttachment(id);
    return res.redirect(302, attachment.fileUrl);
  },
};
