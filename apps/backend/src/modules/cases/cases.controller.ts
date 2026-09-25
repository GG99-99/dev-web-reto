import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { casesService } from './cases.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';
import { UPLOADS_DIR } from '@/lib/upload/upload';

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
    const safeName = path.basename(attachment.fileName).replace(/[\r\n"]/g, '');
    const filePath = path.join(UPLOADS_DIR, path.basename(attachment.fileUrl));
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(filePath);
    } catch {
      throw ApiError.notFound('Official report file is not available');
    }
    res.setHeader('Content-Type', attachment.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(bytes);
  },
};
