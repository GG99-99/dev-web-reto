import { z } from 'zod';

/**
 * auth.schemas.ts
 * ---------------------------------------------------------------------------
 * Validación runtime (zod) 1:1 con los tipos de `@reto/shared/auth.ts`.
 * ---------------------------------------------------------------------------
 */

export const LoginSchema = z.object({
  usuario: z.string().min(1, 'Username (email or ID) is required'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const Verify2FASchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'OTP code must be exactly 6 digits'),
});
