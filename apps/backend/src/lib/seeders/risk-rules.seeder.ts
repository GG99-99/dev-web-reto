import prisma from '@reto/db';
import { logSeed } from './seed.utils';

/**
 * risk-rules.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `risk_frequency_rule`. RF-14 (sección 12 del contrato).
 * Sin estas reglas, `POST /evaluations/:id/finish` falla con 500 porque el
 * motor de riesgo no puede mapear el puntaje a nivel/frecuencia.
 *
 * ⚠️ Umbrales PLACEHOLDER tomados del comentario del schema.prisma
 * ("1.0-3.6 Bajo/Anual, 3.6-6.3 Medio/Semestral, >6.3 Alto/Trimestral").
 * Ajustar con PATCH /catalogs/risk-frequency-rules/:id cuando esté la matriz
 * oficial; no hace falta volver a correr el seeder.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const RISK_RULES = [
  { minScore: 0, maxScore: 3.6, riskLevel: 'BAJO' as const, frequency: 'ANUAL' as const },
  { minScore: 3.6, maxScore: 6.3, riskLevel: 'MEDIO' as const, frequency: 'SEMESTRAL' as const },
  { minScore: 6.3, maxScore: null, riskLevel: 'ALTO' as const, frequency: 'TRIMESTRAL' as const },
];

// ============================ SEEDING =============================

export async function seedRiskRules() {
  let created = 0;
  let skipped = 0;

  for (const rule of RISK_RULES) {
    const existing = await prisma.riskFrequencyRule.findFirst({
      where: { minScore: rule.minScore, riskLevel: rule.riskLevel },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.riskFrequencyRule.create({ data: rule });
    created++;
  }

  logSeed('risk-frequency-rules', created, skipped);
}
