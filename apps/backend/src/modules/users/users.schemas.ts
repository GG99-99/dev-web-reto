import { z } from 'zod';
import { PaginationQuerySchema } from '@/lib/common/schemas';
import { isValidNationalId, isValidPhone } from '@/lib/common/fieldFormats';

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
  name: z.string().trim().min(2, 'Enter the full name'),
  cedula: z.string().trim().refine(isValidNationalId, 'National ID must use the format 000-0000000-0'),
  phone: z.string().trim().refine(isValidPhone, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email address'),
});

export const RegisterUserSchema = z.object({
  person: PersonInputSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roleId: z.coerce.number().int().positive(),
  cartaAutorizacionFileId: z.coerce.number().int().positive().optional(),
});

/** PATCH /users/:id — partial update of `Person` data. */
export const UpdateUserSchema = PersonInputSchema.partial();

export const UpdateUserStatusSchema = z.object({
  status: z.enum(['APROBADO', 'RECHAZADO']),
  motivoRechazo: z.string().optional(),
});
