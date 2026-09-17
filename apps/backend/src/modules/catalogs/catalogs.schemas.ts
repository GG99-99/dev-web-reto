import { z } from 'zod';

export const MunicipalitiesQuerySchema = z.object({
  provinceId: z.coerce.number().int().positive().optional(),
});

export const FoodsQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
});

export const CategoryIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
