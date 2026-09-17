import { z } from 'zod';
import { PaginationQuerySchema } from '@/lib/common/schemas';

/**
 * history.schemas.ts
 * ---------------------------------------------------------------------------
 * Validación runtime de `GET /history/search`. Sección 15 de
 * API_CONTRACTS.md (RF-20). Mantenido 1:1 con `HistorySearchQuery` de
 * `@reto/shared`.
 * ---------------------------------------------------------------------------
 */
export const HistorySearchQuerySchema = PaginationQuerySchema.extend({
  institutionId: z.coerce.number().int().positive().optional(),
  bpmRequestId: z.coerce.number().int().positive().optional(),
  evaluationId: z.coerce.number().int().positive().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  status: z.string().optional(),
  entityType: z.enum(['CASE', 'EVALUATION', 'BPM_REQUEST']).optional(),
});
