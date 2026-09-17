import prisma, { type Prisma } from '@reto/db';

/**
 * evidences.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `Evidence`. Sección 13 de API_CONTRACTS.md (RF-15).
 * ---------------------------------------------------------------------------
 */
export const evidencesModel = {
  getManyByEvaluation: async (evaluationId: number) => {
    return prisma.evidence.findMany({ where: { evaluationId }, orderBy: { capturedAt: 'desc' } });
  },

  getById: async (evidenceId: number) => {
    return prisma.evidence.findUnique({ where: { evidenceId } });
  },

  create: async (data: Prisma.EvidenceUncheckedCreateInput) => {
    return prisma.evidence.create({ data });
  },

  delete: async (evidenceId: number) => {
    return prisma.evidence.delete({ where: { evidenceId } });
  },
};
