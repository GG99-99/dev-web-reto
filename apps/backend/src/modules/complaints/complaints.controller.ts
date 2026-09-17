import type { Request, Response } from 'express';
import { complaintsService } from './complaints.service';
import { ok } from '@/lib/common/response';

/**
 * complaints.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 9 de API_CONTRACTS.md (RF-09).
 * ---------------------------------------------------------------------------
 */
export const complaintsController = {
  getMany: async (req: Request, res: Response) => {
    const query = req.validated!.query;
    const data = await complaintsService.getMany(query);
    return res.status(200).json(ok(data));
  },

  getOne: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const data = await complaintsService.getById(id);
    return res.status(200).json(ok(data));
  },

  create: async (req: Request, res: Response) => {
    const body = req.validated!.body;
    const data = await complaintsService.create(body);
    return res.status(201).json(ok(data));
  },

  setResultado: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const { resultado } = req.validated!.body;
    const data = await complaintsService.setResultado(id, resultado);
    return res.status(200).json(ok(data));
  },

  generateCase: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const data = await complaintsService.generateCase(id);
    return res.status(201).json(ok(data));
  },
};
