import prisma, { Prisma, type ReportStatus, type ReviewAction, type CorrectionScope } from '@reto/db';

/**
 * reports.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `EvaluationReport` y `ReportReview`. Sección 14 de
 * API_CONTRACTS.md (RF-16, RF-17, RF-18).
 * ---------------------------------------------------------------------------
 */

const DETAIL_INCLUDE = {
  attachments: true,
  reviews: {
    include: { coordinator: { include: { person: true } } },
    orderBy: { reviewedAt: 'desc' as const },
  },
} satisfies Prisma.EvaluationReportInclude;

async function moveCase(tx: Prisma.TransactionClient, caseId: number, status: 'EN_EVALUACION' | 'EN_REVISION') {
  const current = await tx.case.findUnique({ where: { caseId }, select: { status: true } });
  if (!current || current.status === 'CERRADO' || current.status === status) return;
  await tx.case.update({ where: { caseId }, data: { status } });
}

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

  correct: async (
    reportId: number,
    data: Prisma.EvaluationReportUpdateInput,
    options: { incrementVersion: boolean; markSaved: boolean },
  ) => {
    return prisma.evaluationReport.update({
      where: { reportId },
      data: {
        ...data,
        ...(options.incrementVersion ? { version: { increment: 1 } } : {}),
        ...(options.markSaved ? { correctionSavedAt: new Date() } : {}),
      },
      include: DETAIL_INCLUDE,
    });
  },

  /**
   * First submission and resubmission both publish the same report.
   * Resubmission also closes the open correction and returns the evaluation to FINALIZADA.
   */
  publish: async (
    reportId: number,
    evaluationId: number,
    caseId: number,
    options: { closeCorrection: boolean },
  ) => {
    return prisma.$transaction(async (tx) => {
      const report = await tx.evaluationReport.update({
        where: { reportId },
        data: {
          status: 'ENVIADO',
          locked: true,
          ...(options.closeCorrection
            ? {
                correctionScope: null,
                flaggedSections: Prisma.DbNull,
                correctionRequestedAt: null,
                correctionSavedAt: null,
              }
            : {}),
        },
        include: DETAIL_INCLUDE,
      });
      if (options.closeCorrection) {
        await tx.evaluation.update({
          where: { evaluationId },
          data: { status: 'FINALIZADA', finishedAt: new Date() },
        });
      }
      await moveCase(tx, caseId, 'EN_REVISION');
      return report;
    });
  },

  approve: async (reportId: number, evaluationId: number, caseId: number, coordinatorId: number, comments?: string) => {
    return prisma.$transaction(async (tx) => {
      await tx.reportReview.create({
        data: { reportId, coordinatorId, action: 'APROBAR', comments },
      });
      const report = await tx.evaluationReport.update({
        where: { reportId },
        data: {
          status: 'APROBADO',
          locked: true,
          correctionScope: null,
          flaggedSections: Prisma.DbNull,
          correctionRequestedAt: null,
          correctionSavedAt: null,
        },
        include: DETAIL_INCLUDE,
      });
      await tx.evaluation.update({
        where: { evaluationId },
        data: { status: 'FINALIZADA' },
      });
      await moveCase(tx, caseId, 'EN_REVISION');
      return report;
    });
  },

  /**
   * Returns the same evaluation for correction. Does not create a form response
   * and does not touch answers, evidence, or report narrative.
   */
  returnForCorrection: async (
    reportId: number,
    evaluationId: number,
    caseId: number,
    review: {
      coordinatorId: number;
      action: ReviewAction;
      comments: string;
      correctionScope: CorrectionScope;
      flaggedSections: string[] | null;
    },
  ) => {
    return prisma.$transaction(async (tx) => {
      await tx.reportReview.create({
        data: {
          reportId,
          coordinatorId: review.coordinatorId,
          action: review.action,
          comments: review.comments,
          correctionScope: review.correctionScope,
          flaggedSections: review.flaggedSections ?? Prisma.DbNull,
        },
      });
      const report = await tx.evaluationReport.update({
        where: { reportId },
        data: {
          status: review.correctionScope === 'COMPLETA' ? 'DEVUELTO' : 'EN_CORRECCION',
          locked: false,
          correctionScope: review.correctionScope,
          flaggedSections: review.flaggedSections ?? Prisma.DbNull,
          correctionRequestedAt: new Date(),
          correctionSavedAt: null,
        },
        include: DETAIL_INCLUDE,
      });
      await tx.evaluation.update({
        where: { evaluationId },
        data: { status: 'EN_CORRECCION' },
      });
      await moveCase(tx, caseId, 'EN_EVALUACION');
      return report;
    });
  },

  getReviews: async (reportId: number) => {
    return prisma.reportReview.findMany({
      where: { reportId },
      include: { coordinator: { include: { person: true } } },
      orderBy: { reviewedAt: 'desc' },
    });
  },
};
