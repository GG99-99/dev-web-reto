import prisma, { type Prisma, type ReportStatus, type ReviewAction } from '@reto/db';

/**
 * reports.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `EvaluationReport` y `ReportReview`. Sección 14 de
 * API_CONTRACTS.md (RF-16, RF-17, RF-18).
 * ---------------------------------------------------------------------------
 */

const DETAIL_INCLUDE = {
  attachments: true,
  reviews: { include: { coordinator: { include: { person: true } } } },
} satisfies Prisma.EvaluationReportInclude;

export const reportsModel = {
  getByEvaluationId: async (evaluationId: number) => {
    return prisma.evaluationReport.findUnique({ where: { evaluationId }, include: DETAIL_INCLUDE });
  },

  getById: async (reportId: number) => {
    return prisma.evaluationReport.findUnique({ where: { reportId }, include: DETAIL_INCLUDE });
  },

  create: async (
    evaluationId: number,
    data: Pick<Prisma.EvaluationReportUncheckedCreateInput, 'resumenEjecutivo' | 'hallazgos' | 'noConformidades' | 'recomendaciones'>,
  ) => {
    return prisma.evaluationReport.create({ data: { evaluationId, ...data }, include: DETAIL_INCLUDE });
  },

  updateStatus: async (reportId: number, status: ReportStatus, locked: boolean) => {
    return prisma.evaluationReport.update({ where: { reportId }, data: { status, locked }, include: DETAIL_INCLUDE });
  },

  correct: async (reportId: number, data: Prisma.EvaluationReportUpdateInput) => {
    return prisma.evaluationReport.update({
      where: { reportId },
      data: { ...data, version: { increment: 1 } },
      include: DETAIL_INCLUDE,
    });
  },

  addReview: async (reportId: number, coordinatorId: number, action: ReviewAction, comments?: string) => {
    return prisma.reportReview.create({ data: { reportId, coordinatorId, action, comments } });
  },

  getReviews: async (reportId: number) => {
    return prisma.reportReview.findMany({
      where: { reportId },
      include: { coordinator: { include: { person: true } } },
      orderBy: { reviewedAt: 'desc' },
    });
  },
};
