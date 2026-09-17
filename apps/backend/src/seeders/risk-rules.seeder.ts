import prisma from '@reto/db';

/**
 * risk-rules.seeder.ts
 * ---------------------------------------------------------------------------
 * Crea las 3 reglas por defecto de la matriz de frecuencia de inspección,
 * usando el ejemplo textual que aparece como comentario en
 * documentos/schema.prisma: "1.0-3.6 Bajo/Anual, 3.6-6.3 Medio/Semestral,
 * >6.3 Alto/Trimestral". Estos umbrales son un placeholder — ver el TODO en
 * risk-engine.service.ts — y deben reemplazarse por los reales cuando estén
 * disponibles (vía PATCH /catalogs/risk-frequency-rules/:id, no hace falta
 * volver a correr este seeder).
 *
 * Uso: pnpm --filter @reto/backend seed:risk-rules
 * ---------------------------------------------------------------------------
 */

const RULES = [
  { minScore: 0, maxScore: 3.6, riskLevel: 'BAJO' as const, frequency: 'ANUAL' as const },
  { minScore: 3.6, maxScore: 6.3, riskLevel: 'MEDIO' as const, frequency: 'SEMESTRAL' as const },
  { minScore: 6.3, maxScore: null, riskLevel: 'ALTO' as const, frequency: 'TRIMESTRAL' as const },
];

export async function seedRiskRules() {
  const existing = await prisma.riskFrequencyRule.count();
  if (existing > 0) {
    console.log('[seed] risk-frequency-rules ya tiene datos, no se sobreescribe');
    return;
  }
  await prisma.riskFrequencyRule.createMany({ data: RULES });
  console.log(`[seed] ${RULES.length} reglas de riesgo creadas`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedRiskRules()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] error', err);
      process.exit(1);
    });
}
