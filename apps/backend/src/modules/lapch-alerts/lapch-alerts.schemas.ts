import { z } from 'zod';
import { PaginationQuerySchema, IdParamSchema } from '@/lib/common/schemas';

export const GetLapchAlertsQuerySchema = PaginationQuerySchema.extend({
  institutionId: z.coerce.number().int().positive().optional(),
  resultado: z.enum(['PROCEDE', 'NO_PROCEDE']).optional(),
});

export const CreateLapchAlertSchema = z.object({
  institutionId: z.coerce.number().int().positive(),
  numeroAlerta: z.string().min(1),
  fecha: z.coerce.date(),
  producto: z.string().min(1),
  descripcion: z.string().min(1),
});

export const SetLapchResultSchema = z.object({
  resultado: z.enum(['PROCEDE', 'NO_PROCEDE']),
});

export { IdParamSchema };
