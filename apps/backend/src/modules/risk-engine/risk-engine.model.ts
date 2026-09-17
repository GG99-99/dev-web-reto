import prisma, { type Prisma } from '@reto/db';

/**
 * risk-engine.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `EvaluationScore` y `RiskFrequencyRule`. Sección 12 de
 * API_CONTRACTS.md (RF-14).
 * ---------------------------------------------------------------------------
 */
export const riskEngineModel = {
  getScoreByEvaluation: async (evaluationId: number) => {
    return prisma.evaluationScore.findUnique({ where: { evaluationId } });
  },

  /** Busca la regla cuyo rango [minScore, maxScore) contiene `score`. `maxScore = null` = sin techo. */
  findMatchingRule: async (score: number) => {
    return prisma.riskFrequencyRule.findFirst({
      where: {
        minScore: { lte: score },
        OR: [{ maxScore: null }, { maxScore: { gte: score } }],
      },
      orderBy: { minScore: 'desc' },
    });
  },

  upsertScore: async (evaluationId: number, data: Omit<Prisma.EvaluationScoreUncheckedCreateInput, 'evaluationId'>) => {
    return prisma.evaluationScore.upsert({
      where: { evaluationId },
      create: { evaluationId, ...data },
      update: data,
    });
  },

  getRules: async () => {
    return prisma.riskFrequencyRule.findMany({ orderBy: { minScore: 'asc' } });
  },

  updateRule: async (ruleId: number, data: Prisma.RiskFrequencyRuleUpdateInput) => {
    return prisma.riskFrequencyRule.update({ where: { ruleId }, data });
  },
};
