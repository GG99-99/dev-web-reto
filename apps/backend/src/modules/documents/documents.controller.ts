import type { Request, Response } from 'express';
import { documentsService } from './documents.service';
import { ok } from '@/lib/common/response';

export const documentsController = {
  verify: async (req: Request, res: Response) => {
    const { token } = req.validated!.query as { token: string };
    const data = await documentsService.verify(token);
    return res.status(200).json(ok(data));
  },
};
