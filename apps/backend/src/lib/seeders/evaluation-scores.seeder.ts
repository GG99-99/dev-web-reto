import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';
import { EVAL_REASONS } from './evaluations.seeder';

/**
 * evaluation-scores.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `evaluation_score`. RF-14 (sección 12 del contrato,
 * GET /evaluations/:id/score).
 *
 * DEPENDE DE: evaluations.seeder.ts (y conceptualmente de
 * risk-rules.seeder.ts, cuyos umbrales deben ser coherentes con los valores
 * de abajo).
 *
 * En producción esta tabla NO se escribe a mano: la llena el motor de riesgo
 * al ejecutar POST /evaluations/:id/finish. Aquí se siembra solo para las
 * evaluaciones ya FINALIZADAS, de modo que el dashboard, el historial y el
 * informe tengan datos que mostrar sin tener que simular una inspección
 * completa.
 *
 * `evaluationId` es la PK (no autoincrement): 1 score por evaluación.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const SCORES: {
  evaluationReason: string;
  puntajeObtenido: number;
  porcentajeCumplimiento: number;
  nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO';
  frecuenciaInspeccion: 'ANUAL' | 'SEMESTRAL' | 'TRIMESTRAL';
  calculatedDays: number;
}[] = [
  {
    evaluationReason: EVAL_REASONS.PANADERIA_INICIAL,
    puntajeObtenido: 2.4,
    porcentajeCumplimiento: 86.7,
    nivelRiesgo: 'BAJO',
    frecuenciaInspeccion: 'ANUAL',
    calculatedDays: -28,
  },
];

// ============================ SEEDING =============================

export async function seedEvaluationScores() {
  let created = 0;
  let skipped = 0;

  for (const item of SCORES) {
    const evaluation = required(
      await prisma.evaluation.findFirst({ where: { reason: item.evaluationReason } }),
      `evaluación "${item.evaluationReason}" (corre evaluations.seeder primero)`,
    );

    const existing = await prisma.evaluationScore.findUnique({
      where: { evaluationId: evaluation.evaluationId },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.evaluationScore.create({
      data: {
        evaluationId: evaluation.evaluationId,
        puntajeObtenido: item.puntajeObtenido,
        porcentajeCumplimiento: item.porcentajeCumplimiento,
        nivelRiesgo: item.nivelRiesgo,
        frecuenciaInspeccion: item.frecuenciaInspeccion,
        calculatedAt: daysFromNow(item.calculatedDays),
      },
    });
    created++;
  }

  logSeed('evaluation-scores', created, skipped);
}
