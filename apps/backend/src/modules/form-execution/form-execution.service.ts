import type { FinishEvaluationResponse, FormAnswers } from '@reto/shared';
import { formExecutionModel } from './form-execution.model';
import { formTemplatesModel } from './form-templates.model';
import { assertEvaluationFormComplete, getEvaluationFormTemplate, loadEvaluationForm } from './form-completeness';
import { evaluationsService } from '../evaluations/evaluations.service';
import { assertAnswerEdit, markCorrectionProgress } from '../reports/correction-policy';
import { riskEngineService } from '../risk-engine/risk-engine.service';
import { reportsService } from '../reports/reports.service';
import { ApiError } from '@/lib/common/ApiError';
import prisma from '@reto/db';

/**
 * form-execution.service.ts
 * ---------------------------------------------------------------------------
 * Orquesta RF-12/RF-13 (ejecución) y dispara RF-14 (motor de riesgo) y RF-16
 * (informe autogenerado) al finalizar. Sección 11.2 de API_CONTRACTS.md.
 *
 * ⚠️ GAP DE CONTRATO: `@reto/shared/formExecution.ts` no define un tipo
 * `StartEvaluationRequest`. Sin embargo `FormResponse` (tabla ya existente)
 * exige `representId` y `foodId` (no nulos) además de la plantilla. Se
 * infiere que `POST /evaluations/:id/start` debe recibir esos 2 campos (ver
 * StartEvaluationSchema en form-execution.schemas.ts). TODO: confirmar con
 * el equipo de producto y, si aplica, agregar el tipo formal al contrato.
 * ---------------------------------------------------------------------------
 */

export const formExecutionService = {
  getTemplates: async (): Promise<any> => formTemplatesModel.getMany(),

  getTemplateTree: async (formTemplateId: number): Promise<any> => {
    const tree = await formTemplatesModel.getTreeById(formTemplateId);
    if (!tree) throw ApiError.notFound('Form template not found');
    return tree;
  },

  getEvaluationTemplate: async (evaluationId: number, requesterId: number, role?: string | null) => {
    return getEvaluationFormTemplate(evaluationId, requesterId, role);
  },

  getExecutionDetail: async (evaluationId: number): Promise<any> => {
    const detail = await formExecutionModel.getExecutionDetail(evaluationId);
    if (!detail) throw ApiError.notFound('Evaluation not found');
    return detail;
  },

  start: async (evaluationId: number, requesterId: number, data: { representId: number; foodId: number }, role?: string | null): Promise<any> => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (role !== 'ADMIN' && evaluation.technicianId !== requesterId) {
      throw ApiError.forbidden('Only the assigned technician can start this evaluation');
    }
    if (evaluation.formResponseId) {
      throw ApiError.conflict('This evaluation already has a working record. Continue that record instead of starting over.');
    }
    if (evaluation.status !== 'PROGRAMADA' && evaluation.status !== 'REPROGRAMADA') {
      throw ApiError.conflict('The evaluation is not in a state that allows it to be started');
    }

    const form = await loadEvaluationForm(evaluationId);
    const templateId = form?.template?.formTemplateId;
    if (!templateId) throw ApiError.validation('No evaluation form is configured for this request type');

    const represent = await prisma.represent.findUnique({
      where: { representId: data.representId },
      select: { institutionId: true },
    });
    if (!represent || represent.institutionId !== evaluation.institutionId) {
      throw ApiError.forbidden('That representative is not accredited for this establishment');
    }

    return formExecutionModel.start(evaluationId, {
      formTemplateId: templateId,
      institutionId: evaluation.institutionId,
      representId: data.representId,
      foodId: data.foodId,
      motive: evaluation.reason ?? 'Good Manufacturing Practices (BPM) Evaluation',
    });
  },

  saveAnswers: async (evaluationId: number, requesterId: number, answers: FormAnswers, role?: string | null): Promise<FormAnswers> => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (role !== 'ADMIN' && evaluation.technicianId !== requesterId) {
      throw ApiError.forbidden('Only the assigned technician can edit this evaluation');
    }
    if (evaluation.status !== 'EN_PROCESO' && evaluation.status !== 'EN_CORRECCION') {
      throw ApiError.conflict(
        evaluation.status === 'FINALIZADA'
          ? 'This evaluation is locked. Answers can be edited again only after the coordinator returns it for correction.'
          : 'The evaluation must be in progress (started) to record answers',
      );
    }
    if (!evaluation.formResponseId) {
      throw ApiError.conflict('The evaluation does not have an active form session (POST /evaluations/:id/start first)');
    }

    const existingReport = await prisma.evaluationReport.findUnique({ where: { evaluationId } });
    if (existingReport?.locked) {
      throw ApiError.forbidden('This evaluation report is locked; answers cannot be edited');
    }

    const edit = await assertAnswerEdit(evaluation, answers);
    const saved = await formExecutionModel.upsertAnswers(evaluation.formResponseId, answers);
    if (edit.changed) await markCorrectionProgress(evaluationId);
    return saved;
  },

  finish: async (evaluationId: number, requesterId: number, role?: string | null): Promise<FinishEvaluationResponse> => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (role !== 'ADMIN' && evaluation.technicianId !== requesterId) {
      throw ApiError.forbidden('Only the assigned technician can finalize this evaluation');
    }
    if (evaluation.status === 'EN_CORRECCION') {
      throw ApiError.conflict('This evaluation was returned for correction. Save the requested changes and resubmit the same report.');
    }
    if (evaluation.status !== 'EN_PROCESO') {
      throw ApiError.conflict('The evaluation must be in progress to be finalized');
    }
    if (!evaluation.formResponseId) {
      throw ApiError.conflict('The evaluation does not have a completed form session');
    }

    const { answers } = await assertEvaluationFormComplete(evaluationId);

    // 1) RF-14: motor de riesgo, using only answers that belong to the required chapters
    const score = await riskEngineService.computeAndPersist(evaluationId, answers);

    // 2) transición de estado de la Evaluation
    const finished = await formExecutionModel.finish(evaluationId);

    // 3) RF-16: informe autogenerado
    const report = await reportsService.autoGenerate(evaluationId, {
      institutionName: (await prisma.institution.findUniqueOrThrow({ where: { institutionId: evaluation.institutionId } })).name,
      evaluationDate: evaluation.scheduledDate,
      risk: score,
      answers,
    });

    return {
      evaluation: finished,
      score: await riskEngineService.getByEvaluation(evaluationId),
      report,
    };
  },
};
