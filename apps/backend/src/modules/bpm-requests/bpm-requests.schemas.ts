import { z } from 'zod';
import { PaginationQuerySchema, IdParamSchema } from '@/lib/common/schemas';

export const GetBpmRequestsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['BORRADOR', 'PENDIENTE_ASIGNACION', 'EN_REVISION', 'RECHAZADA', 'APROBADA']).optional(),
  institutionId: z.coerce.number().int().positive().optional(),
});

export const CreateBpmRequestSchema = z.object({
  institutionId: z.coerce.number().int().positive(),
  tipoEstablecimiento: z.string().min(1),
  motivo: z.string().min(1),
  observaciones: z.string().optional(),
});

export const UpdateBpmRequestSchema = z.object({
  tipoEstablecimiento: z.string().min(1).optional(),
  motivo: z.string().min(1).optional(),
  observaciones: z.string().optional(),
});

export { IdParamSchema };
