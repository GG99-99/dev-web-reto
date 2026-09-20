import { Router, type Router as ExpressRouter } from 'express';
import { validateJwt, validateReq } from '#backend/middlewares';
import { authController } from './auth.controller';
import {
  LoginSchema,
  RefreshSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  Verify2FASchema,
} from './auth.schemas';

/**
 * auth.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /auth (montado bajo /api/v1 en api.router.ts)
 * Sección 1 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */
export const authRouter: ExpressRouter = Router();

authRouter
  // Público
  .post('/auth/login', validateReq(LoginSchema, 'body'), authController.login)
  .post('/auth/refresh', validateReq(RefreshSchema, 'body'), authController.refresh)
  .post('/auth/password/forgot', validateReq(ForgotPasswordSchema, 'body'), authController.forgotPassword)
  .post('/auth/password/reset', validateReq(ResetPasswordSchema, 'body'), authController.resetPassword)
  .post('/auth/2fa/verify', validateReq(Verify2FASchema, 'body'), authController.verify2FA)

  // Autenticado
  .post('/auth/logout', validateJwt, validateReq(RefreshSchema, 'body'), authController.logout)
  .post('/auth/password/change', validateJwt, validateReq(ChangePasswordSchema, 'body'), authController.changePassword)
  .post('/auth/2fa/enable', validateJwt, authController.enable2FA);
