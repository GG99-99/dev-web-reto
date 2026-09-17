import prisma, { type Prisma, type BpmRequestStatus } from '@reto/db';

/**
 * bpm-requests.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `BpmRequest`. Sección 5 de API_CONTRACTS.md (RF-05).
 * ---------------------------------------------------------------------------
 */

export interface BpmRequestsFilter {
  status?: BpmRequestStatus;
  institutionId?: number;
  createdById?: number;
}

const LIST_INCLUDE = {
  institution: { select: { institutionId: true, name: true } },
} satisfies Prisma.BpmRequestInclude;

const DETAIL_INCLUDE = {
  institution: true,
  attachments: true,
  case: true,
} satisfies Prisma.BpmRequestInclude;

export const bpmRequestsModel = {
  getMany: async (filter: BpmRequestsFilter, skip: number, take: number, orderBy: Prisma.BpmRequestOrderByWithRelationInput) => {
    const where: Prisma.BpmRequestWhereInput = {
      ...(filter.status && { status: filter.status }),
      ...(filter.institutionId && { institutionId: filter.institutionId }),
      ...(filter.createdById && { createdById: filter.createdById }),
    };

    const [items, total] = await Promise.all([
      prisma.bpmRequest.findMany({ where, include: LIST_INCLUDE, skip, take, orderBy }),
      prisma.bpmRequest.count({ where }),
    ]);

    return { items, total };
  },

  getById: async (bpmRequestId: number) => {
    return prisma.bpmRequest.findUnique({ where: { bpmRequestId }, include: DETAIL_INCLUDE });
  },

  create: async (data: Pick<Prisma.BpmRequestUncheckedCreateInput, 'tipoEstablecimiento' | 'motivo' | 'observaciones' | 'institutionId'>, createdById: number) => {
    return prisma.bpmRequest.create({ data: { ...data, createdById } });
  },

  update: async (bpmRequestId: number, data: Prisma.BpmRequestUpdateInput) => {
    return prisma.bpmRequest.update({ where: { bpmRequestId }, data });
  },

  /** RF-05 "submit": pasa a PENDIENTE_ASIGNACION y crea el Case en una sola transacción. */
  submit: async (bpmRequestId: number, institutionId: number) => {
    return prisma.$transaction(async (tx) => {
      await tx.bpmRequest.update({
        where: { bpmRequestId },
        data: { status: 'PENDIENTE_ASIGNACION', sentAt: new Date() },
      });

      const createdCase = await tx.case.create({
        data: {
          origin: 'SOLICITUD_EMPRESA',
          institutionId,
          bpmRequestId,
        },
      });

      const bpmRequest = await tx.bpmRequest.findUniqueOrThrow({ where: { bpmRequestId }, include: DETAIL_INCLUDE });

      return { bpmRequest, case: createdCase };
    });
  },
};
