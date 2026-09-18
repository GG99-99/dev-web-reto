import prisma from '@reto/db';
import { logSeed, required } from './seed.utils';
import { EVAL_REASONS } from './evaluations.seeder';

/**
 * form-responses.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `form_response`. RF-12 / RF-13 (sección 11.2 del contrato).
 *
 * DEPENDE DE: form-templates, institutions, represents, foods y evaluations.
 *
 * Es la ficha diligenciada. El JSON `answers` sigue el tipo `FormAnswers` del
 * contrato: un ARREGLO de `{ key, txt, value }` (ver
 * @reto/shared/formExecution.ts). `key` es el identificador compuesto de la
 * pregunta (ej. "h3_ask:123", usado internamente para el upsert parcial),
 * `txt` es el texto real de la pregunta y `value` es la respuesta:
 * C = Cumple, CP = Cumple Parcialmente, NC = No Cumple, N/A = No Aplica.
 *
 * Las respuestas NO se inventan pregunta por pregunta: se recorren las
 * preguntas REALES de la plantilla activa y se les aplica un patrón cíclico
 * de valores (ver FORM_RESPONSES.pattern), de modo que cada evaluación quede
 * con una mezcla conocida de C / CP / NC / N-A y el motor de riesgo
 * produzca niveles distintos.
 *
 * Además enlaza la ficha con su Evaluation (`Evaluation.formResponseId`).
 * ---------------------------------------------------------------------------
 */

type AskValue = 'C' | 'CP' | 'NC' | 'N/A';

const FORM_RESPONSES: {
  /** Evaluación a la que pertenece la ficha (por `reason`). */
  evaluationReason: string;
  name: string;
  motive: string;
  /** Representante de la empresa que acompañó la inspección (cédula). */
  representCedula: string;
  /** Alimento sobre el que se hizo la inspección. */
  foodName: string;
  /** Patrón cíclico de respuestas aplicado a las preguntas reales, en orden. */
  pattern: AskValue[];
}[] = [
  {
    evaluationReason: EVAL_REASONS.PANADERIA_INICIAL,
    name: 'Ficha BPM — Panadería El Sol (inicial)',
    motive: 'Solicitud inicial de certificación BPM',
    representCedula: '003-0000005-5',
    foodName: 'Bizcocho de vainilla',
    // Mayoría conforme -> riesgo BAJO
    pattern: ['C', 'C', 'C', 'CP', 'C', 'C', 'N/A', 'C'],
  },
  {
    evaluationReason: EVAL_REASONS.DISTRIBUIDORA_RUTINA,
    name: 'Ficha BPM — Distribuidora Caribe (rutina)',
    motive: 'Inspección de rutina programada',
    representCedula: '003-0000001-1',
    foodName: 'Habichuelas enlatadas',
    // Mezcla con no conformidades -> riesgo MEDIO/ALTO
    pattern: ['C', 'NC', 'CP', 'NC', 'C', 'NC', 'CP', 'C'],
  },
];

// ========================== HELPERS ===============================

/** Devuelve { key, txt } de todas las preguntas reales de la plantilla activa. */
async function collectAsks(formTemplateId: number): Promise<{ key: string; txt: string }[]> {
  const h3Asks = await prisma.h3Ask.findMany({
    where: { active: true, h3: { h2: { h1: { formTemplateId } } } },
    select: { h3AskId: true, name: true },
    orderBy: { h3AskId: 'asc' },
  });
  const h4Asks = await prisma.h4Ask.findMany({
    where: { active: true, h4: { h3: { h2: { h1: { formTemplateId } } } } },
    select: { h4AskId: true, name: true },
    orderBy: { h4AskId: 'asc' },
  });

  return [
    ...h3Asks.map((a) => ({ key: `h3_ask:${a.h3AskId}`, txt: a.name })),
    ...h4Asks.map((a) => ({ key: `h4_ask:${a.h4AskId}`, txt: a.name })),
  ];
}

// ============================ SEEDING =============================

export async function seedFormResponses() {
  let created = 0;
  let skipped = 0;

  const template = required(
    await prisma.formTemplate.findFirst({ where: { active: true }, orderBy: { createAt: 'desc' } }),
    'plantilla activa (corre form-templates.seeder primero)',
  );
  const asks = await collectAsks(template.formTemplateId);
  if (asks.length === 0) {
    throw new Error('[seed] La plantilla activa no tiene preguntas; revisa form-templates.seeder');
  }

  for (const item of FORM_RESPONSES) {
    const existing = await prisma.formResponse.findFirst({ where: { name: item.name } });
    if (existing) {
      skipped++;
      continue;
    }

    const evaluation = required(
      await prisma.evaluation.findFirst({ where: { reason: item.evaluationReason } }),
      `evaluación "${item.evaluationReason}" (corre evaluations.seeder primero)`,
    );
    const person = required(
      await prisma.person.findUnique({ where: { cedula: item.representCedula } }),
      `persona con cédula ${item.representCedula}`,
    );
    const represent = required(
      await prisma.represent.findFirst({ where: { personId: person.personId } }),
      `representante de ${item.representCedula} (corre represents.seeder primero)`,
    );
    const food = required(
      await prisma.food.findFirst({ where: { name: item.foodName } }),
      `alimento "${item.foodName}" (corre foods.seeder primero)`,
    );

    // [{ key, txt, value }] — key identifica la pregunta, txt es su texto real.
    const answers = asks.map((ask, i) => ({
      key: ask.key,
      txt: ask.txt,
      value: item.pattern[i % item.pattern.length],
    }));

    const formResponse = await prisma.formResponse.create({
      data: {
        name: item.name,
        createAt: evaluation.startedAt ?? new Date(),
        formTemplateId: template.formTemplateId,
        institutionId: evaluation.institutionId,
        representId: represent.representId,
        foodId: food.foodId,
        motive: item.motive,
        answers,
      },
    });

    // Enlace 1:1 con la evaluación (Evaluation.formResponseId es @unique).
    await prisma.evaluation.update({
      where: { evaluationId: evaluation.evaluationId },
      data: { formResponseId: formResponse.formResponseId },
    });

    created++;
  }

  logSeed('form-responses', created, skipped);
}
