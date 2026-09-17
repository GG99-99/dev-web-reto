import type { Request, Response } from 'express';
import { usersService } from './users.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * users.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 2 de API_CONTRACTS.md. Los endpoints `:id` permiten ADMIN o el
 * propio usuario dueño del recurso (se valida aquí porque requiere comparar
 * `req.user.userId` contra el `:id` de la ruta, algo que `validateRole` no
 * puede resolver de forma genérica).
 * ---------------------------------------------------------------------------
 */

function assertSelfOrAdmin(req: Request, targetUserId: number) {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.role === 'ADMIN') return;
  if (req.user.userId === targetUserId) return;
  throw ApiError.forbidden();
}

export const usersController = {
  getMany: async (req: Request, res: Response) => {
    const query = req.validated!.query;
    const data = await usersService.getMany(query);
    return res.status(200).json(ok(data));
  },

  getOne: async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    assertSelfOrAdmin(req, userId);
    const data = await usersService.getById(userId);
    return res.status(200).json(ok(data));
  },

  register: async (req: Request, res: Response) => {
    const body = req.validated!.body;
    const data = await usersService.register(body);
    return res.status(201).json(ok(data));
  },

  update: async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    assertSelfOrAdmin(req, userId);
    const body = req.validated!.body;
    const data = await usersService.update(userId, body);
    return res.status(200).json(ok(data));
  },

  updateStatus: async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    const body = req.validated!.body;
    const data = await usersService.updateStatus(userId, body);
    return res.status(200).json(ok(data));
  },

  remove: async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    const data = await usersService.softDelete(userId);
    return res.status(200).json(ok(data));
  },
};
