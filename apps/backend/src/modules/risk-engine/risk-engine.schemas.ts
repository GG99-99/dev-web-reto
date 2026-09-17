import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const UpdateRiskRuleSchema = z.object({
  minScore: z.coerce.number().optional(),
  maxScore: z.coerce.number().nullable().optional(),
  riskLevel: z.enum(['BAJO', 'MEDIO', 'ALTO']).optional(),
  frequency: z.enum(['ANUAL', 'SEMESTRAL', 'TRIMESTRAL']).optional(),
});
