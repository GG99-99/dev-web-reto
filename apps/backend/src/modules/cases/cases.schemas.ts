import { z } from 'zod';
import { PaginationQuerySchema, IdParamSchema, CasePrioritySchema } from '@/lib/common/schemas';

export const GetCasesQuerySchema = PaginationQuerySchema.extend({
  origin: z.enum(['SOLICITUD_EMPRESA', 'PROGRAMACION_INSTITUCIONAL', 'ALERTA_LAPCH', 'DENUNCIA']).optional(),
  status: z.enum(['ABIERTO', 'ASIGNADO', 'EN_EVALUACION', 'EN_REVISION', 'CERRADO']).optional(),
  priority: CasePrioritySchema.optional(),
  institutionId: z.coerce.number().int().positive().optional(),
  technicianId: z.coerce.number().int().positive().optional(),
});

export const CreateInstitutionalCaseSchema = z.object({
  institutionId: z.coerce.number().int().positive(),
  priority: CasePrioritySchema,
  motivo: z.string().min(1),
});

export const UpdateCasePrioritySchema = z.object({
  priority: CasePrioritySchema,
});

export const CloseCaseSchema = z.object({
  resultadoFinal: z.string().min(1),
  emitirInforme: z.boolean(),
});

export { IdParamSchema };
