import { z } from 'zod';
import { PaginationQuerySchema } from '@/lib/common/schemas';

/**
 * users.schemas.ts
 * ---------------------------------------------------------------------------
 * Validación runtime 1:1 con `@reto/shared/users.ts`. Sección 2 de
 * API_CONTRACTS.md (RF-02 / RNF-02).
 * ---------------------------------------------------------------------------
 */

export const GetUsersQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['PENDIENTE_VALIDACION', 'APROBADO', 'RECHAZADO']).optional(),
  roleId: z.coerce.number().int().positive().optional(),
});

const PersonInputSchema = z.object({
  name: z.string().min(1),
  cedula: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
});

export const RegisterUserSchema = z.object({
  person: PersonInputSchema,
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  roleId: z.coerce.number().int().positive(),
  cartaAutorizacionFileId: z.coerce.number().int().positive().optional(),
});

/** PATCH /users/:id — edición parcial de los datos de `Person`. */
export const UpdateUserSchema = PersonInputSchema.partial();

export const UpdateUserStatusSchema = z.object({
  status: z.enum(['APROBADO', 'RECHAZADO']),
  motivoRechazo: z.string().optional(),
});
