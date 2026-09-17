import { z } from 'zod';

/**
 * auth.schemas.ts
 * ---------------------------------------------------------------------------
 * Validación runtime (zod) 1:1 con los tipos de `@reto/shared/auth.ts`.
 * ---------------------------------------------------------------------------
 */

export const LoginSchema = z.object({
  usuario: z.string().min(1, 'El usuario (email o cédula) es requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});

export const Verify2FASchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'El código OTP debe tener 6 dígitos'),
});
