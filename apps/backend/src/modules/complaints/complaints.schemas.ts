import { z } from 'zod';
import { PaginationQuerySchema, IdParamSchema } from '@/lib/common/schemas';

export const GetComplaintsQuerySchema = PaginationQuerySchema.extend({
  institutionId: z.coerce.number().int().positive().optional(),
  resultado: z.enum(['PROCEDE', 'NO_PROCEDE', 'REMISION_OTRO_PROCESO']).optional(),
});

export const CreateComplaintSchema = z.object({
  tipoDenuncia: z.string().min(1),
  fechaRecepcion: z.coerce.date(),
  denunciante: z.string().min(1),
  descripcion: z.string().min(1),
  institutionId: z.coerce.number().int().positive().optional(),
});

export const SetComplaintResultSchema = z.object({
  resultado: z.enum(['PROCEDE', 'NO_PROCEDE', 'REMISION_OTRO_PROCESO']),
});

export { IdParamSchema };
