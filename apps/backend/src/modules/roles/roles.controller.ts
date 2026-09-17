import type { Request, Response } from 'express';
import type { Role } from '@reto/shared';
import { rolesService } from './roles.service';
import { ok } from '@/lib/common/response';

export const rolesController = {
  getMany: async (_req: Request, res: Response) => {
    const data: Role[] = await rolesService.getMany();
    return res.status(200).json(ok(data));
  },
};
