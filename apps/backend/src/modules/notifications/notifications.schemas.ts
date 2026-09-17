import { z } from 'zod';
import { PaginationQuerySchema, IdParamSchema } from '@/lib/common/schemas';

export const GetNotificationsQuerySchema = PaginationQuerySchema.extend({
  // z.coerce.boolean() convertiría cualquier string no vacío (incluido "false")
  // a `true`; por eso se mapea explícitamente desde el string de query.
  read: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export { IdParamSchema };
