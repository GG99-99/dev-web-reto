import type { Request, Response } from 'express';
import { lapchAlertsService } from './lapch-alerts.service';
import { ok } from '@/lib/common/response';

/**
 * lapch-alerts.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 8 de API_CONTRACTS.md (RF-08). Todo el módulo es de
 * COORDINADOR/ADMIN (validado en el router).
 * ---------------------------------------------------------------------------
 */
export const lapchAlertsController = {
  getMany: async (req: Request, res: Response) => {
    const query = req.validated!.query;
    const data = await lapchAlertsService.getMany(query);
    return res.status(200).json(ok(data));
  },

  getOne: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const data = await lapchAlertsService.getById(id);
    return res.status(200).json(ok(data));
  },

  create: async (req: Request, res: Response) => {
    const body = req.validated!.body;
    const data = await lapchAlertsService.create(body);
    return res.status(201).json(ok(data));
  },

  setResultado: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const { resultado } = req.validated!.body;
    const data = await lapchAlertsService.setResultado(id, resultado);
    return res.status(200).json(ok(data));
  },

  generateCase: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const data = await lapchAlertsService.generateCase(id);
    return res.status(201).json(ok(data));
  },

  close: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const data = await lapchAlertsService.close(id);
    return res.status(200).json(ok(data));
  },
};
