import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';
import { EVAL_REASONS } from './evaluations.seeder';

/**
 * report-reviews.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `report_review`. RF-17 / RF-18 (sección 14 del contrato,
 * GET /reports/:id/reviews).
 *
 * DEPENDE DE: evaluation-reports.seeder.ts y users.seeder.ts.
 * Es el historial de acciones del coordinador sobre un informe. Se siembra
 * una secuencia realista (devolución → aprobación) para que el historial
 * tenga más de una fila.
 * Clave natural: el trío (reportId, coordinatorId, reviewedAt).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const REVIEWS: {
  evaluationReason: string;
  coordinatorCedula: string;
  action: 'APROBAR' | 'DEVOLVER' | 'SOLICITAR_CORRECCION';
  comments: string;
  reviewedDays: number;
}[] = [
  {
    evaluationReason: EVAL_REASONS.PANADERIA_INICIAL,
    coordinatorCedula: '001-0000002-2',
    action: 'SOLICITAR_CORRECCION',
    comments: 'Ampliar el detalle de las no conformidades y citar el artículo del reglamento aplicable.',
    reviewedDays: -20,
  },
  {
    evaluationReason: EVAL_REASONS.PANADERIA_INICIAL,
    coordinatorCedula: '001-0000002-2',
    action: 'APROBAR',
    comments: 'Correcciones incorporadas. Informe aprobado.',
    reviewedDays: -5,
  },
  {
    evaluationReason: EVAL_REASONS.DISTRIBUIDORA_RUTINA,
    coordinatorCedula: '001-0000002-2',
    action: 'SOLICITAR_CORRECCION',
    comments: 'Falta adjuntar la evidencia fotográfica del termómetro y precisar las fechas faltantes de registro.',
    reviewedDays: -1,
  },
];

// ============================ SEEDING =============================

export async function seedReportReviews() {
  let created = 0;
  let skipped = 0;

  for (const item of REVIEWS) {
    const evaluation = required(
      await prisma.evaluation.findFirst({ where: { reason: item.evaluationReason } }),
      `evaluación "${item.evaluationReason}" (corre evaluations.seeder primero)`,
    );
    const report = required(
      await prisma.evaluationReport.findUnique({ where: { evaluationId: evaluation.evaluationId } }),
      `informe de "${item.evaluationReason}" (corre evaluation-reports.seeder primero)`,
    );
    const person = required(
      await prisma.person.findUnique({ where: { cedula: item.coordinatorCedula } }),
      `persona con cédula ${item.coordinatorCedula}`,
    );
    const coordinator = required(
      await prisma.user.findUnique({ where: { personId: person.personId } }),
      `usuario coordinador ${item.coordinatorCedula} (corre users.seeder primero)`,
    );

    const reviewedAt = daysFromNow(item.reviewedDays);
    const existing = await prisma.reportReview.findFirst({
      where: { reportId: report.reportId, coordinatorId: coordinator.userId, reviewedAt },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.reportReview.create({
      data: {
        reportId: report.reportId,
        coordinatorId: coordinator.userId,
        action: item.action,
        comments: item.comments,
        reviewedAt,
      },
    });
    created++;
  }

  logSeed('report-reviews', created, skipped);
}
