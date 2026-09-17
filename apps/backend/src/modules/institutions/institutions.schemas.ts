import { z } from 'zod';
import { PaginationQuerySchema, IdParamSchema } from '@/lib/common/schemas';

/**
 * institutions.schemas.ts
 * ---------------------------------------------------------------------------
 * Validación runtime 1:1 con `@reto/shared/institutions.ts`. Sección 3 de
 * API_CONTRACTS.md (RF-03).
 * ---------------------------------------------------------------------------
 */

export const GetInstitutionsQuerySchema = PaginationQuerySchema.extend({
  provinceId: z.coerce.number().int().positive().optional(),
  municipalityId: z.coerce.number().int().positive().optional(),
  rnc: z.string().optional(),
  q: z.string().optional(),
});

export const CreateInstitutionSchema = z.object({
  name: z.string().min(1),
  streetName: z.string().min(1),
  streetNum: z.coerce.number().int(),
  phoneNumber: z.string().min(1),
  email: z.string().email(),
  rnc: z.string().min(1),
  nombreComercial: z.string().optional(),
  actividadEconomica: z.string().optional(),
  municipalityId: z.coerce.number().int().positive(),
});

export const UpdateInstitutionSchema = CreateInstitutionSchema.partial();

const PersonInputSchema = z.object({
  name: z.string().min(1),
  cedula: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
});

export const CreateRepresentSchema = z.object({
  person: PersonInputSchema,
  type: z.enum(['LEGAL', 'CALIDAD', 'CONTACTO']),
});

export const UpdateRepresentSchema = z.object({
  person: PersonInputSchema.partial().optional(),
  type: z.enum(['LEGAL', 'CALIDAD', 'CONTACTO']).optional(),
});

export { IdParamSchema };
