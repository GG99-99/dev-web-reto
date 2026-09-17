import { z } from 'zod';

export const AssignTechnicianSchema = z.object({
  technicianId: z.coerce.number().int().positive(),
  notes: z.string().optional(),
});
