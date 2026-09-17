import { z } from 'zod';
import { IdParamSchema } from '@/lib/common/schemas';

export const ReviewReportSchema = z.object({
  action: z.enum(['APROBAR', 'DEVOLVER', 'SOLICITAR_CORRECCION']),
  comments: z.string().optional(),
});

export const CorrectReportSchema = z.object({
  resumenEjecutivo: z.string().min(1).optional(),
  hallazgos: z.string().min(1).optional(),
  noConformidades: z.string().min(1).optional(),
  recomendaciones: z.string().min(1).optional(),
});

export { IdParamSchema };
