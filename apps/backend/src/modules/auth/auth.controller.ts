import type { Request, Response } from 'express';
import type {
  LoginResponse,
  RefreshResponse,
  Enable2FAResponse,
} from '@reto/shared';
import { authService } from './auth.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * auth.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 1 (RF-01) de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */
export const authController = {
  login: async (req: Request, res: Response) => {
    const body = req.validated!.body;
    const data: LoginResponse = await authService.login(body);
    return res.status(200).json(ok(data));
  },

  refresh: async (req: Request, res: Response) => {
    const body = req.validated!.body;
    const data: RefreshResponse = await authService.refresh(body);
    return res.status(200).json(ok(data));
  },

  logout: async (req: Request, res: Response) => {
    const body = req.validated!.body;
    await authService.logout(body.refreshToken);
    return res.status(200).json(ok(null));
  },

  forgotPassword: async (req: Request, res: Response) => {
    const body = req.validated!.body;
    await authService.forgotPassword(body);
    return res.status(200).json(ok(null));
  },

  resetPassword: async (req: Request, res: Response) => {
    const body = req.validated!.body;
    await authService.resetPassword(body);
    return res.status(200).json(ok(null));
  },

  changePassword: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = req.validated!.body;
    await authService.changePassword(req.user.userId, body);
    return res.status(200).json(ok(null));
  },

  enable2FA: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data: Enable2FAResponse = await authService.enable2FA(req.user.userId);
    return res.status(200).json(ok(data));
  },

  verify2FA: async (req: Request, res: Response) => {
    const body = req.validated!.body;
    const data: LoginResponse = await authService.verify2FA(body);
    return res.status(200).json(ok(data));
  },
};
