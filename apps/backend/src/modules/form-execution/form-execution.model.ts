import prisma, { type Prisma } from '@reto/db';
import type { FormAnswers } from '@reto/shared';

/**
 * form-execution.model.ts
 * ---------------------------------------------------------------------------
 * Sección 11.2 de API_CONTRACTS.md (ejecución en campo: start/answers/finish).
 * Reutiliza `Evaluation` (evaluations.model.ts la usa para programación) y
 * crea/actualiza el `FormResponse` (ficha diligenciada, RF-13) asociado.
 *
 * `FormResponse.answers` se guarda como un ARREGLO de
 * `{ key, txt, value }` (ver `FormAnswers`/`AskAnswer` en
 * @reto/shared/formExecution.ts): `key` identifica la pregunta (ej.
 * "h3_ask:123"), `txt` es su texto y `value` la respuesta.
 * ---------------------------------------------------------------------------
 */

const EXECUTION_INCLUDE = { formResponse: true, evidences: true } satisfies Prisma.EvaluationInclude;

/** Lee `FormResponse.answers` como `FormAnswers`, tolerando `null`/formatos viejos. */
function readAnswers(raw: Prisma.JsonValue | null | undefined): FormAnswers {
  return Array.isArray(raw) ? (raw as unknown as FormAnswers) : [];
}

export const formExecutionModel = {
  getExecutionDetail: async (evaluationId: number) => {
    return prisma.evaluation.findUnique({ where: { evaluationId }, include: EXECUTION_INCLUDE });
  },

  /** RF-12: crea el FormResponse vacío y marca la evaluación EN_PROCESO. */
  start: async (
    evaluationId: number,
    data: { formTemplateId: number; institutionId: number; representId: number; foodId: number; motive: string },
  ) => {
    return prisma.$transaction(async (tx) => {
      const formResponse = await tx.formResponse.create({
        data: {
          name: `Ejecución evaluación #${evaluationId}`,
          createAt: new Date(),
          formTemplateId: data.formTemplateId,
          institutionId: data.institutionId,
          representId: data.representId,
          foodId: data.foodId,
          motive: data.motive,
          answers: [],
        },
      });

      return tx.evaluation.update({
        where: { evaluationId },
        data: { status: 'EN_PROCESO', startedAt: new Date(), formResponseId: formResponse.formResponseId },
        include: EXECUTION_INCLUDE,
      });
    });
  },

  /**
   * RF-13: upsert parcial por `key` sobre el arreglo `FormResponse.answers`.
   * Si `key` ya existe se reemplaza (nuevo `txt`/`value`); si no, se agrega.
   */
  upsertAnswers: async (formResponseId: number, incoming: FormAnswers): Promise<FormAnswers> => {
    const current = await prisma.formResponse.findUniqueOrThrow({ where: { formResponseId } });
    const existing = readAnswers(current.answers);

    const byKey = new Map(existing.map((a) => [a.key, a]));
    for (const answer of incoming) {
      byKey.set(answer.key, answer);
    }
    const result: FormAnswers = Array.from(byKey.values());

    await prisma.formResponse.update({
      where: { formResponseId },
      data: { answers: result as unknown as Prisma.InputJsonValue },
    });

    return result;
  },

  finish: async (evaluationId: number) => {
    return prisma.evaluation.update({
      where: { evaluationId },
      data: { status: 'FINALIZADA', finishedAt: new Date() },
      include: EXECUTION_INCLUDE,
    });
  },
};

export { readAnswers };
