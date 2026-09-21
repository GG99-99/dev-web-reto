import prisma, { type Prisma, type EvaluationStatus, type CasePriority } from '@reto/db';

/**
 * evaluations.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `Evaluation`. Sección 7 de API_CONTRACTS.md (RF-07,
 * RF-11). La ejecución en campo (start/answers/finish, sección 11.2) vive
 * en form-execution.model.ts, que reutiliza este mismo modelo Prisma.
 * ---------------------------------------------------------------------------
 */

export interface EvaluationsFilter {
  status?: EvaluationStatus;
  technicianId?: number;
  institutionId?: number;
  from?: Date;
  to?: Date;
}

const LIST_INCLUDE = {
  institution: { select: { institutionId: true, name: true, streetName: true } },
  technician: {
    select: {
      userId: true,
      personId: true,
      roleId: true,
      status: true,
      isActive: true,
      createdAt: true,
      person: true,
    },
  },
} satisfies Prisma.EvaluationInclude;

export const evaluationsModel = {
  getMany: async (filter: EvaluationsFilter, skip: number, take: number, orderBy: Prisma.EvaluationOrderByWithRelationInput) => {
    const where: Prisma.EvaluationWhereInput = {
      ...(filter.status && { status: filter.status }),
      ...(filter.technicianId && { technicianId: filter.technicianId }),
      ...(filter.institutionId && { institutionId: filter.institutionId }),
      ...((filter.from || filter.to) && {
        scheduledDate: {
          ...(filter.from && { gte: filter.from }),
          ...(filter.to && { lte: filter.to }),
        },
      }),
    };

    const [items, total] = await Promise.all([
      prisma.evaluation.findMany({ where, include: LIST_INCLUDE, skip, take, orderBy }),
      prisma.evaluation.count({ where }),
    ]);

    return { items, total };
  },

  getById: async (evaluationId: number) => {
    return prisma.evaluation.findUnique({
      where: { evaluationId },
      include: {
        ...LIST_INCLUDE,
        formResponse: true,
        evidences: true,
      },
    });
  },

  create: async (data: {
    caseId: number;
    institutionId: number;
    technicianId: number;
    scheduledDate: Date;
    reason?: string;
    priority: CasePriority;
    observations?: string;
  }) => {
    return prisma.$transaction(async (tx) => {
      const evaluation = await tx.evaluation.create({ data, include: LIST_INCLUDE });
      await tx.case.update({ where: { caseId: data.caseId }, data: { status: 'EN_EVALUACION' } });
      return evaluation;
    });
  },

  reschedule: async (evaluationId: number, scheduledDate: Date, observations?: string) => {
    return prisma.evaluation.update({
      where: { evaluationId },
      data: { scheduledDate, status: 'REPROGRAMADA', ...(observations !== undefined && { observations }) },
      include: LIST_INCLUDE,
    });
  },

  cancel: async (evaluationId: number) => {
    return prisma.evaluation.update({ where: { evaluationId }, data: { status: 'CANCELADA' }, include: LIST_INCLUDE });
  },

  getCalendar: async (technicianId: number, from: Date, to: Date) => {
    return prisma.evaluation.findMany({
      where: { technicianId, scheduledDate: { gte: from, lte: to } },
      select: { evaluationId: true, scheduledDate: true, status: true, institutionId: true },
      orderBy: { scheduledDate: 'asc' },
    });
  },
};
