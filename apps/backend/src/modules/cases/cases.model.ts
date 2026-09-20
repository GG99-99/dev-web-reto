import prisma, { type Prisma, type CaseOrigin, type CasePriority, type CaseStatus } from '@reto/db';

/**
 * cases.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `Case`. Sección 6 de API_CONTRACTS.md (RF-06, RF-19).
 * ---------------------------------------------------------------------------
 */

export interface CasesFilter {
  origin?: CaseOrigin;
  status?: CaseStatus;
  priority?: CasePriority;
  institutionId?: number;
  technicianId?: number;
}

const DETAIL_INCLUDE = {
  institution: true,
  coordinator: {
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
  bpmRequest: true,
  lapchAlert: true,
  complaint: true,
  evaluations: true,
  assignments: true,
  attachments: true,
} satisfies Prisma.CaseInclude;

export const casesModel = {
  getMany: async (filter: CasesFilter, skip: number, take: number, orderBy: Prisma.CaseOrderByWithRelationInput) => {
    const where: Prisma.CaseWhereInput = {
      ...(filter.origin && { origin: filter.origin }),
      ...(filter.status && { status: filter.status }),
      ...(filter.priority && { priority: filter.priority }),
      ...(filter.institutionId && { institutionId: filter.institutionId }),
      ...(filter.technicianId && { technicianId: filter.technicianId }),
    };

    const [items, total] = await Promise.all([
      prisma.case.findMany({ where, include: { institution: true }, skip, take, orderBy }),
      prisma.case.count({ where }),
    ]);

    return { items, total };
  },

  getById: async (caseId: number) => {
    return prisma.case.findUnique({ where: { caseId }, include: DETAIL_INCLUDE });
  },

  create: async (data: { institutionId: number; priority: CasePriority }) => {
    return prisma.case.create({
      data: {
        origin: 'PROGRAMACION_INSTITUCIONAL',
        institutionId: data.institutionId,
        priority: data.priority,
      },
    });
  },

  updatePriority: async (caseId: number, priority: CasePriority) => {
    return prisma.case.update({ where: { caseId }, data: { priority } });
  },

  close: async (caseId: number, resultadoFinal: string) => {
    return prisma.case.update({
      where: { caseId },
      data: { status: 'CERRADO', closedAt: new Date(), resultadoFinal },
      include: DETAIL_INCLUDE,
    });
  },

  attachOfficialReport: async (
    caseId: number,
    attachment: { fileName: string; fileUrl: string; mimeType: string; uploadedById: number },
  ) => {
    return prisma.attachment.create({
      data: {
        category: 'INFORME_OFICIAL_PDF',
        caseId,
        ...attachment,
      },
    });
  },

  getOfficialReportAttachment: async (caseId: number) => {
    return prisma.attachment.findFirst({
      where: { caseId, category: 'INFORME_OFICIAL_PDF' },
      orderBy: { createdAt: 'desc' },
    });
  },
};
