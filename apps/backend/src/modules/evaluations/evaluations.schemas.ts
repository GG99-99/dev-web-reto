import { z } from 'zod';
import { PaginationQuerySchema, IdParamSchema, CasePrioritySchema } from '@/lib/common/schemas';

export const GetEvaluationsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['PROGRAMADA', 'REPROGRAMADA', 'CANCELADA', 'EN_PROCESO', 'FINALIZADA']).optional(),
  technicianId: z.coerce.number().int().positive().optional(),
  institutionId: z.coerce.number().int().positive().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const CreateEvaluationSchema = z.object({
  caseId: z.coerce.number().int().positive(),
  technicianId: z.coerce.number().int().positive(),
  scheduledDate: z.coerce.date(),
  reason: z.string().optional(),
  priority: CasePrioritySchema,
  observations: z.string().optional(),
});

export const RescheduleEvaluationSchema = z.object({
  scheduledDate: z.coerce.date(),
  observations: z.string().optional(),
});

export const CalendarQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  view: z.enum(['day', 'week', 'month']),
});

export { IdParamSchema };
