import prisma from '@reto/db';
import {
  assessFormCompleteness,
  type FormCaseContext,
  type FormCompleteness,
} from '@reto/shared';
import { ApiError } from '@/lib/common/ApiError';
import { readAnswers } from './form-execution.model';
import { formTemplatesModel } from './form-templates.model';

/**
 * Loads the form template that belongs to this evaluation.
 * A started session keeps the template stored on its form response.
 * Before that, the active template whose appliesTo scope matches the case
 * origin and establishment type is selected. Chapters are then filtered by
 * the same rules inside assessFormCompleteness.
 */
export async function loadEvaluationForm(evaluationId: number) {
  const evaluation = await prisma.evaluation.findUnique({
    where: { evaluationId },
    include: {
      formResponse: true,
      institution: { select: { actividadEconomica: true, name: true } },
      case: {
        select: {
          origin: true,
          bpmRequest: { select: { tipoEstablecimiento: true } },
        },
      },
    },
  });
  if (!evaluation) return null;

  const context: FormCaseContext = {
    origin: evaluation.case?.origin ?? null,
    establishmentType: evaluation.case?.bpmRequest?.tipoEstablecimiento ?? null,
    institutionActivity: evaluation.institution?.actividadEconomica ?? null,
  };

  const boundTemplateId = evaluation.formResponse?.formTemplateId ?? null;
  const templateId = boundTemplateId ?? (await formTemplatesModel.resolveActiveId(context));
  const template = templateId ? await formTemplatesModel.getTreeById(templateId) : null;

  return { evaluation, context, template };
}

export async function assertEvaluationFormComplete(evaluationId: number): Promise<{
  completeness: FormCompleteness;
  answers: ReturnType<typeof readAnswers>;
}> {
  const loaded = await loadEvaluationForm(evaluationId);
  if (!loaded) throw ApiError.notFound('Evaluation not found');
  if (!loaded.evaluation.formResponse) {
    throw ApiError.validation('The evaluation does not have a form session to validate');
  }
  if (!loaded.template) {
    throw ApiError.validation('No evaluation form is configured for this request type');
  }

  const answers = readAnswers(loaded.evaluation.formResponse.answers);
  const completeness = assessFormCompleteness(loaded.template, answers, loaded.context);
  if (!completeness.canSubmit) {
    throw ApiError.validation(completeness.blockReason ?? 'Required chapters are incomplete', {
      chapters: completeness.chapters.map((chapter) => ({
        name: chapter.name,
        status: chapter.status,
        answered: chapter.answered,
        required: chapter.required,
        skipReason: chapter.skipReason,
      })),
    });
  }

  const applicable = new Set(completeness.applicableKeys);
  return {
    completeness,
    answers: answers.filter((answer) => applicable.has(answer.key)),
  };
}

export async function getEvaluationFormTemplate(evaluationId: number, requesterId: number, role?: string | null) {
  const loaded = await loadEvaluationForm(evaluationId);
  if (!loaded) throw ApiError.notFound('Evaluation not found');
  if (role === 'TECNICO_EVALUADOR' && loaded.evaluation.technicianId !== requesterId) {
    throw ApiError.forbidden('Only the assigned technician can open this evaluation form');
  }
  if (!loaded.template) {
    throw ApiError.validation('No evaluation form is configured for this request type');
  }

  const answers = loaded.evaluation.formResponse ? readAnswers(loaded.evaluation.formResponse.answers) : [];
  return {
    formTemplateId: loaded.template.formTemplateId,
    context: loaded.context,
    template: loaded.template,
    completeness: assessFormCompleteness(loaded.template, answers, loaded.context),
  };
}
