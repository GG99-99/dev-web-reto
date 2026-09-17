import prisma, { type Prisma } from '@reto/db';
import type { AskAnswer } from '@reto/shared';

/**
 * form-execution.model.ts
 * ---------------------------------------------------------------------------
 * Sección 11.2 de API_CONTRACTS.md (ejecución en campo: start/answers/finish).
 * Reutiliza `Evaluation` (evaluations.model.ts la usa para programación) y
 * crea/actualiza el `FormResponse` (ficha diligenciada, RF-13) asociado.
 * ---------------------------------------------------------------------------
 */

const EXECUTION_INCLUDE = { formResponse: true, evidences: true } satisfies Prisma.EvaluationInclude;

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

  /** RF-13: upsert parcial por `askId` sobre el JSON `FormResponse.answers`. */
  upsertAnswers: async (formResponseId: number, incoming: AskAnswer[]): Promise<AskAnswer[]> => {
    const current = await prisma.formResponse.findUniqueOrThrow({ where: { formResponseId } });
    const existing = Array.isArray(current.answers) ? (current.answers as unknown as AskAnswer[]) : [];

    const merged = new Map(existing.map((a) => [a.askId, a]));
    for (const answer of incoming) merged.set(answer.askId, answer);
    const result = Array.from(merged.values());

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
