import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';

/**
 * institution-status.seeder.ts
 * ---------------------------------------------------------------------------
 * Tablas: `institution_status` y `institution_status_question`.
 *
 * DEPENDE DE: institutions.seeder.ts.
 * Modelos heredados del ERD original (marcados [EXISTENTE] en schema.prisma):
 * guardan la certificación vigente de una institución y el cuestionario
 * asociado. Hoy NINGÚN endpoint del contrato los escribe; se siembran para
 * que `GET /institutions/:id` y el historial devuelvan algo y para no dejar
 * tablas vacías al probar.
 *
 * Las dos tablas van en un mismo seeder porque las preguntas no existen
 * fuera de su `institution_status` padre (FK obligatoria).
 * Clave natural: el par (institutionId, validUntil).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const INSTITUTION_STATUSES: {
  rnc: string;
  validUntilDays: number;
  questions: { question: string; type: string; value: string }[];
}[] = [
  {
    rnc: '130987654',
    validUntilDays: 330,
    questions: [
      { question: '¿Posee certificación BPM vigente?', type: 'BOOLEAN', value: 'true' },
      { question: 'Nivel de riesgo asignado', type: 'TEXT', value: 'BAJO' },
      { question: 'Frecuencia de inspección', type: 'TEXT', value: 'ANUAL' },
    ],
  },
  {
    rnc: '130123456',
    validUntilDays: -30, // vencida: útil para probar filtros de vigencia
    questions: [
      { question: '¿Posee certificación BPM vigente?', type: 'BOOLEAN', value: 'false' },
      { question: 'Motivo', type: 'TEXT', value: 'Certificación vencida, en proceso de renovación' },
    ],
  },
];

// ============================ SEEDING =============================

export async function seedInstitutionStatus() {
  let created = 0;
  let skipped = 0;
  let questionsCreated = 0;

  for (const item of INSTITUTION_STATUSES) {
    const institution = required(
      await prisma.institution.findFirst({ where: { rnc: item.rnc } }),
      `institución con RNC ${item.rnc} (corre institutions.seeder primero)`,
    );

    const validUntil = daysFromNow(item.validUntilDays);
    const existing = await prisma.institutionStatus.findFirst({
      where: { institutionId: institution.institutionId, validUntil },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const status = await prisma.institutionStatus.create({
      data: { institutionId: institution.institutionId, validUntil },
    });
    created++;

    for (const q of item.questions) {
      await prisma.institutionStatusQuestion.create({
        data: {
          institutionStatusId: status.institutionStatusId,
          question: q.question,
          type: q.type,
          value: q.value,
        },
      });
      questionsCreated++;
    }
  }

  logSeed('institution-status', created, skipped);
  if (questionsCreated > 0) {
    console.log(`[seed] institution-status-questions creadas: ${questionsCreated}`);
  }
}
