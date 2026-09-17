import { z } from 'zod';

/**
 * schemas.ts
 * ---------------------------------------------------------------------------
 * Schemas zod reutilizables por todos los módulos. `@reto/shared` define los
 * *tipos* (compile-time); estos schemas son la validación en *runtime* que
 * exige la sección 19.3 de API_CONTRACTS.md, mantenidos 1:1 con esos tipos.
 * ---------------------------------------------------------------------------
 */

/** Convierte query params (siempre string) a número, sin romper si vienen ya numéricos. */
const coercedInt = () => z.coerce.number().int();

export const PaginationQuerySchema = z.object({
  page: coercedInt().positive().optional(),
  pageSize: coercedInt().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

export const IdParamSchema = z.object({
  id: coercedInt().positive(),
});

export const CasePrioritySchema = z.enum(['BAJA', 'MEDIA', 'ALTA']);
