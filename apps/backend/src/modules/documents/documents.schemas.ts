import { z } from 'zod';

export const VerifyDocumentQuerySchema = z.object({
  token: z.string().trim().min(20).max(2000),
});
