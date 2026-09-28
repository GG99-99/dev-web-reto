import prisma, { type Prisma } from '@reto/db';
import { deriveLifecycleStatus, pickCurrentEvaluation, type HistorySearchItem } from '@reto/shared';

/**
 * history.model.ts
 * ---------------------------------------------------------------------------
 * Sección 15 de API_CONTRACTS.md (RF-20). Agregador de lectura sobre
 * Case | Evaluation | BpmRequest — no es una tabla propia.
 * ---------------------------------------------------------------------------
 */

export interface HistoryFilter {
  institutionIds?: number[]; // scope para ADMIN_EMPRESA
  institutionId?: number;
  bpmRequestId?: number;
  evaluationId?: number;
  fechaDesde?: Date;
  fechaHasta?: Date;
  status?: string;
}

function scopeWhere(filter: HistoryFilter, institutionField: 'institutionId' = 'institutionId') {
  const where: Record<string, unknown> = {};
  if (filter.institutionIds) {
    const allowed = filter.institutionIds;
    if (filter.institutionId != null && !allowed.includes(filter.institutionId)) {
      where[institutionField] = -1;
    } else if (filter.institutionId != null) {
      where[institutionField] = filter.institutionId;
    } else if (allowed.length === 0) {
      where[institutionField] = -1;
    } else {
      where[institutionField] = { in: allowed };
    }
    return where;
  }
  if (filter.institutionId) where[institutionField] = filter.institutionId;
  return where;
}

export const historyModel = {
  evaluationInstitutionId: async (evaluationId: number) => {
    const row = await prisma.evaluation.findUnique({
      where: { evaluationId },
      select: { institutionId: true },
    });
    return row?.institutionId ?? null;
  },

  bpmRequestInstitutionId: async (bpmRequestId: number) => {
    const row = await prisma.bpmRequest.findUnique({
      where: { bpmRequestId },
      select: { institutionId: true },
    });
    return row?.institutionId ?? null;
  },

  searchCases: async (filter: HistoryFilter): Promise<HistorySearchItem[]> => {
    const where: Prisma.CaseWhereInput = {
      ...scopeWhere(filter),
      ...(filter.status && { status: filter.status as Prisma.EnumCaseStatusFilter['equals'] }),
      ...((filter.fechaDesde || filter.fechaHasta) && {
        openedAt: { ...(filter.fechaDesde && { gte: filter.fechaDesde }), ...(filter.fechaHasta && { lte: filter.fechaHasta }) },
      }),
    };
    const cases = await prisma.case.findMany({ where, include: { institution: { select: { institutionId: true, name: true } } } });
    return cases.map((c) => ({
      entityType: 'CASE' as const,
      id: c.caseId,
      institution: c.institution,
      status: c.status,
      createdAt: c.openedAt.toISOString(),
    }));
  },

  searchEvaluations: async (filter: HistoryFilter): Promise<HistorySearchItem[]> => {
    const where: Prisma.EvaluationWhereInput = {
      ...scopeWhere(filter),
      ...(filter.evaluationId && { evaluationId: filter.evaluationId }),
      ...(filter.status && { status: filter.status as Prisma.EnumEvaluationStatusFilter['equals'] }),
      ...((filter.fechaDesde || filter.fechaHasta) && {
        createdAt: { ...(filter.fechaDesde && { gte: filter.fechaDesde }), ...(filter.fechaHasta && { lte: filter.fechaHasta }) },
      }),
    };
    const evaluations = await prisma.evaluation.findMany({
      where,
      include: {
        institution: { select: { institutionId: true, name: true } },
        score: true,
        report: { select: { reportId: true, status: true } },
        case: { select: { status: true, technicianId: true } },
      },
    });
    return evaluations.map((e) => ({
      entityType: 'EVALUATION' as const,
      id: e.evaluationId,
      institution: e.institution,
      status: e.status === 'CANCELADA'
        ? 'CANCELADA'
        : deriveLifecycleStatus({
            caseStatus: e.case.status,
            technicianId: e.case.technicianId,
            evaluationStatus: e.status,
            reportStatus: e.report?.status,
          }),
      createdAt: e.createdAt.toISOString(),
      score: e.score ?? undefined,
      reportSummary: e.report ?? undefined,
    }));
  },

  searchBpmRequests: async (filter: HistoryFilter): Promise<HistorySearchItem[]> => {
    const where: Prisma.BpmRequestWhereInput = {
      ...scopeWhere(filter),
      ...(filter.bpmRequestId && { bpmRequestId: filter.bpmRequestId }),
      ...(filter.status && { status: filter.status as Prisma.EnumBpmRequestStatusFilter['equals'] }),
      ...((filter.fechaDesde || filter.fechaHasta) && {
        createdAt: { ...(filter.fechaDesde && { gte: filter.fechaDesde }), ...(filter.fechaHasta && { lte: filter.fechaHasta }) },
      }),
    };
    const bpmRequests = await prisma.bpmRequest.findMany({
      where,
      include: {
        institution: { select: { institutionId: true, name: true } },
        case: {
          select: {
            status: true,
            technicianId: true,
            evaluations: {
              orderBy: { createdAt: 'desc' },
              select: { status: true, createdAt: true, report: { select: { status: true } } },
            },
          },
        },
      },
    });
    return bpmRequests.map((b) => {
      const evaluation = pickCurrentEvaluation(b.case?.evaluations);
      return {
        entityType: 'BPM_REQUEST' as const,
        id: b.bpmRequestId,
        institution: b.institution,
        status: deriveLifecycleStatus({
          requestStatus: b.status,
          caseStatus: b.case?.status,
          technicianId: b.case?.technicianId,
          evaluationStatus: evaluation?.status,
          reportStatus: evaluation?.report?.status,
        }),
        createdAt: b.createdAt.toISOString(),
      };
    });
  },
};
