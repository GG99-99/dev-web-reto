import prisma, { type Prisma, type LapchResult } from '@reto/db';

/**
 * lapch-alerts.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `LapchAlert`. Sección 8 de API_CONTRACTS.md (RF-08).
 * ---------------------------------------------------------------------------
 */
export interface LapchAlertsFilter {
  institutionId?: number;
  resultado?: LapchResult;
}

export const lapchAlertsModel = {
  getMany: async (filter: LapchAlertsFilter, skip: number, take: number) => {
    const where: Prisma.LapchAlertWhereInput = {
      ...(filter.institutionId && { institutionId: filter.institutionId }),
      ...(filter.resultado && { resultado: filter.resultado }),
    };
    const [items, total] = await Promise.all([
      prisma.lapchAlert.findMany({ where, skip, take, orderBy: { fecha: 'desc' } }),
      prisma.lapchAlert.count({ where }),
    ]);
    return { items, total };
  },

  getById: async (alertId: number) => {
    return prisma.lapchAlert.findUnique({ where: { alertId }, include: { case: true } });
  },

  create: async (data: Prisma.LapchAlertUncheckedCreateInput) => {
    return prisma.lapchAlert.create({ data });
  },

  setResultado: async (alertId: number, resultado: LapchResult) => {
    return prisma.lapchAlert.update({ where: { alertId }, data: { resultado } });
  },

  generateCase: async (alertId: number, institutionId: number) => {
    return prisma.$transaction(async (tx) => {
      const createdCase = await tx.case.create({
        data: { origin: 'ALERTA_LAPCH', institutionId, lapchAlertId: alertId },
      });
      return createdCase;
    });
  },
};
