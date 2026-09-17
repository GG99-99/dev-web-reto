import { z } from 'zod';
import { IdParamSchema } from '@/lib/common/schemas';

export const CreateEvidenceBodySchema = z.object({
  type: z.enum(['FOTO', 'VIDEO', 'DOCUMENTO']),
  comment: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  h1AskId: z.coerce.number().int().positive().optional(),
  h2AskId: z.coerce.number().int().positive().optional(),
  h3AskId: z.coerce.number().int().positive().optional(),
  h4AskId: z.coerce.number().int().positive().optional(),
});

export { IdParamSchema };
