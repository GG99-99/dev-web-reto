import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';
import { EVAL_REASONS } from './evaluations.seeder';

/**
 * evaluation-reports.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `evaluation_report`. RF-16 (sección 14 del contrato).
 *
 * DEPENDE DE: evaluations.seeder.ts.
 * En producción lo genera automáticamente `reports.autoGenerate()` al
 * finalizar la evaluación; aquí se siembra para tener informes en distintos
 * estados del flujo RF-16/17/18 sin simular la inspección completa:
 *   - APROBADO (locked)      -> caso cerrado
 *   - EN_CORRECCION (abierto)-> probar POST /reports/:id/correct y /resend
 *
 * `evaluationId` es @unique: máximo 1 informe por evaluación.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const REPORTS: {
  evaluationReason: string;
  resumenEjecutivo: string;
  hallazgos: string;
  noConformidades: string;
  recomendaciones: string;
  status: 'BORRADOR' | 'ENVIADO' | 'APROBADO' | 'DEVUELTO' | 'EN_CORRECCION';
  version: number;
  locked: boolean;
  generatedDays: number;
}[] = [
  {
    evaluationReason: EVAL_REASONS.PANADERIA_INICIAL,
    resumenEjecutivo:
      'The establishment meets most of the Good Manufacturing Practice requirements that were evaluated. Minor observations were identified that can be corrected in the short term.',
    hallazgos:
      'Infrastructure is in good overall condition. Staff have current health certificates. Cleaning and disinfection records are available and up to date.',
    noConformidades:
      'Partial compliance on hygiene signage in the dispatch area. There was no documented record of the annual GMP training program.',
    recomendaciones:
      'Post handwashing notices in the dispatch area. Document and file the annual training schedule for food handlers.',
    status: 'APROBADO',
    version: 2,
    locked: true,
    generatedDays: -27,
  },
  {
    evaluationReason: EVAL_REASONS.DISTRIBUIDORA_RUTINA,
    resumenEjecutivo:
      'Routine inspection with relevant findings in cold-chain control. A corrective action plan is required.',
    hallazgos:
      'The warehouse keeps general order and adequate pallet separation. Deficiencies were observed in temperature monitoring.',
    noConformidades:
      'Cold-room thermometer has no current calibration certificate. Temperature records are incomplete for the last 30 days.',
    recomendaciones:
      'Calibrate temperature-measuring equipment and keep the certificate. Record temperature twice per shift with an assigned person responsible.',
    status: 'ENVIADO',
    version: 1,
    locked: true,
    generatedDays: -1,
  },
];

// ============================ SEEDING =============================

export async function seedEvaluationReports() {
  let created = 0;
  let skipped = 0;

  for (const item of REPORTS) {
    const evaluation = required(
      await prisma.evaluation.findFirst({ where: { reason: item.evaluationReason } }),
      `evaluación "${item.evaluationReason}" (corre evaluations.seeder primero)`,
    );

    const existing = await prisma.evaluationReport.findUnique({
      where: { evaluationId: evaluation.evaluationId },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.evaluationReport.create({
      data: {
        evaluationId: evaluation.evaluationId,
        resumenEjecutivo: item.resumenEjecutivo,
        hallazgos: item.hallazgos,
        noConformidades: item.noConformidades,
        recomendaciones: item.recomendaciones,
        status: item.status,
        version: item.version,
        locked: item.locked,
        generatedAt: daysFromNow(item.generatedDays),
      },
    });
    created++;
  }

  logSeed('evaluation-reports', created, skipped);
}
