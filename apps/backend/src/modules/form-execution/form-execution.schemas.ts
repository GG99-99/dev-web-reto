import { z } from 'zod';
import { IdParamSchema } from '@/lib/common/schemas';

/** Ver GAP DE CONTRATO anotado en form-execution.service.ts. */
export const StartEvaluationSchema = z.object({
  representId: z.coerce.number().int().positive(),
  foodId: z.coerce.number().int().positive(),
});

/**
 * Ver `AskValue` en @reto/shared/formExecution.ts:
 * C = Cumple, CP = Cumple Parcialmente, NC = No Cumple, N/A = No Aplica.
 */
const AskValueSchema = z.enum(['C', 'CP', 'NC', 'N/A']);

/**
 * Respuesta individual: { key, txt, value }. `key` identifica la pregunta
 * (ej. "h3_ask:123") y es lo que se usa para el upsert parcial; `txt` es el
 * texto de la pregunta (se guarda para no depender de un join al mostrarla);
 * `value` es la respuesta.
 */
const AskAnswerSchema = z.object({
  key: z.string().min(1),
  txt: z.string().min(1),
  value: AskValueSchema,
});

/** Body de `PATCH /evaluations/:id/answers`. */
export const FormAnswersSchema = z.object({
  answers: z.array(AskAnswerSchema).min(1),
});

export { IdParamSchema };
