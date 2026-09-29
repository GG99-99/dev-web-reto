import { z } from 'zod';
import { PaginationQuerySchema, IdParamSchema } from '@/lib/common/schemas';
import { isValidNationalId, isValidPhone, isValidRnc, isValidStreetNumber } from '@/lib/common/fieldFormats';

/**
 * institutions.schemas.ts
 * ---------------------------------------------------------------------------
 * Runtime validation 1:1 with `@reto/shared/institutions.ts`. Section 3 of
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
  name: z.string().trim().min(2, 'Enter the legal company name'),
  streetName: z.string().trim().min(2, 'Enter the street or avenue'),
  streetNum: z.string().trim().refine(isValidStreetNumber, 'Street number must contain digits only').optional(),
  phoneNumber: z.string().trim().refine(isValidPhone, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email address'),
  rnc: z.string().trim().refine(isValidRnc, 'RNC must be exactly 9 digits'),
  nombreComercial: z.string().trim().optional(),
  actividadEconomica: z.string().trim().min(2, 'Enter the economic activity').optional(),
  municipalityId: z.coerce.number().int().positive(),
});

export const UpdateInstitutionSchema = CreateInstitutionSchema.partial();

const PersonInputSchema = z.object({
  name: z.string().trim().min(2, 'Enter the full name'),
  cedula: z.string().trim().refine(isValidNationalId, 'National ID must use the format 000-0000000-0'),
  phone: z.string().trim().refine(isValidPhone, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email address'),
});

export const CreateRepresentSchema = z.object({
  person: PersonInputSchema,
  type: z.enum(['LEGAL', 'CALIDAD', 'CONTACTO']),
});

export const LinkRepresentSchema = z.object({
  personId: z.coerce.number().int().positive(),
  type: z.enum(['LEGAL', 'CALIDAD', 'CONTACTO']),
});

export const UpdateRepresentSchema = z.object({
  person: PersonInputSchema.partial().optional(),
  type: z.enum(['LEGAL', 'CALIDAD', 'CONTACTO']).optional(),
});

export { IdParamSchema };
