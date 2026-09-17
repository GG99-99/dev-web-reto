import { z } from 'zod';
import { IdParamSchema } from '@/lib/common/schemas';

/** Ver GAP DE CONTRATO anotado en form-execution.service.ts. */
export const StartEvaluationSchema = z.object({
  representId: z.coerce.number().int().positive(),
  foodId: z.coerce.number().int().positive(),
});

const AskAnswerSchema = z.object({
  askId: z.string().min(1),
  value: z.enum(['C', 'CP', 'IT', 'N/A', 'NC']),
  observaciones: z.string().optional(),
  comentarios: z.string().optional(),
});

export const FormAnswersSchema = z.object({
  answers: z.array(AskAnswerSchema).min(1),
});

export { IdParamSchema };
