import type { FinishEvaluationResponse, FormAnswers } from '@reto/shared';
import { formExecutionModel, readAnswers } from './form-execution.model';
import { formTemplatesModel } from './form-templates.model';
import { evaluationsService } from '../evaluations/evaluations.service';
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

  getExecutionDetail: async (evaluationId: number): Promise<any> => {
    const detail = await formExecutionModel.getExecutionDetail(evaluationId);
    if (!detail) throw ApiError.notFound('Evaluation not found');
    return detail;
  },

  start: async (evaluationId: number, requesterId: number, data: { representId: number; foodId: number }): Promise<any> => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (evaluation.technicianId !== requesterId) {
      throw ApiError.forbidden('Only the assigned technician can start this evaluation');
    }
    if (evaluation.status !== 'PROGRAMADA' && evaluation.status !== 'REPROGRAMADA') {
      throw ApiError.conflict('The evaluation is not in a state that allows it to be started');
    }

    const template = await formTemplatesModel.getActive();
    if (!template) throw ApiError.internal('No active form template is configured');

    return formExecutionModel.start(evaluationId, {
      formTemplateId: template.formTemplateId,
      institutionId: evaluation.institutionId,
      representId: data.representId,
      foodId: data.foodId,
      motive: evaluation.reason ?? 'Good Manufacturing Practices (BPM) Evaluation',
    });
  },

  saveAnswers: async (evaluationId: number, requesterId: number, answers: FormAnswers): Promise<FormAnswers> => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (evaluation.technicianId !== requesterId) {
      throw ApiError.forbidden('Only the assigned technician can edit this evaluation');
    }
    if (evaluation.status !== 'EN_PROCESO') {
      throw ApiError.conflict('The evaluation must be in progress (started) to record answers');
    }
    if (!evaluation.formResponseId) {
      throw ApiError.conflict('The evaluation does not have an active form session (POST /evaluations/:id/start first)');
    }

    const existingReport = await prisma.evaluationReport.findUnique({ where: { evaluationId } });
    if (existingReport?.locked) {
      throw ApiError.forbidden('This evaluation report is locked; answers cannot be edited');
    }

    return formExecutionModel.upsertAnswers(evaluation.formResponseId, answers);
  },

  finish: async (evaluationId: number, requesterId: number): Promise<FinishEvaluationResponse> => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (evaluation.technicianId !== requesterId) {
      throw ApiError.forbidden('Only the assigned technician can finalize this evaluation');
    }
    if (evaluation.status !== 'EN_PROCESO') {
      throw ApiError.conflict('The evaluation must be in progress to be finalized');
    }
    if (!evaluation.formResponseId) {
      throw ApiError.conflict('The evaluation does not have a completed form session');
    }

    const formResponse = await prisma.formResponse.findUniqueOrThrow({ where: { formResponseId: evaluation.formResponseId } });
    const answers = readAnswers(formResponse.answers);
    if (answers.length === 0) {
      throw ApiError.validation('Cannot finalize an evaluation with no recorded answers');
    }

    // 1) RF-14: motor de riesgo
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
