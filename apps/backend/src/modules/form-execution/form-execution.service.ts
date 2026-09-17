import type { AskAnswer, FinishEvaluationResponse } from '@reto/shared';
import { formExecutionModel } from './form-execution.model';
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
  getTemplates: async () => formTemplatesModel.getMany(),

  getTemplateTree: async (formTemplateId: number) => {
    const tree = await formTemplatesModel.getTreeById(formTemplateId);
    if (!tree) throw ApiError.notFound('La plantilla de formulario no existe');
    return tree;
  },

  getExecutionDetail: async (evaluationId: number) => {
    const detail = await formExecutionModel.getExecutionDetail(evaluationId);
    if (!detail) throw ApiError.notFound('La evaluación no existe');
    return detail;
  },

  start: async (evaluationId: number, requesterId: number, data: { representId: number; foodId: number }) => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (evaluation.technicianId !== requesterId) {
      throw ApiError.forbidden('Solo el técnico asignado puede iniciar esta evaluación');
    }
    if (evaluation.status !== 'PROGRAMADA' && evaluation.status !== 'REPROGRAMADA') {
      throw ApiError.conflict('La evaluación no está en un estado que permita iniciarla');
    }

    const template = await formTemplatesModel.getActive();
    if (!template) throw ApiError.internal('No hay una plantilla de formulario activa configurada');

    return formExecutionModel.start(evaluationId, {
      formTemplateId: template.formTemplateId,
      institutionId: evaluation.institutionId,
      representId: data.representId,
      foodId: data.foodId,
      motive: evaluation.reason ?? 'Evaluación de Buenas Prácticas de Manufactura (BPM)',
    });
  },

  saveAnswers: async (evaluationId: number, requesterId: number, answers: AskAnswer[]): Promise<AskAnswer[]> => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (evaluation.technicianId !== requesterId) {
      throw ApiError.forbidden('Solo el técnico asignado puede editar esta evaluación');
    }
    if (evaluation.status !== 'EN_PROCESO') {
      throw ApiError.conflict('La evaluación debe estar en curso (iniciada) para registrar respuestas');
    }
    if (!evaluation.formResponseId) {
      throw ApiError.conflict('La evaluación no tiene una ficha iniciada (POST /evaluations/:id/start primero)');
    }

    // RF-17: bloqueado si ya existe un informe enviado/aprobado.
    const existingReport = await prisma.evaluationReport.findUnique({ where: { evaluationId } });
    if (existingReport?.locked) {
      throw ApiError.forbidden('El informe de esta evaluación está bloqueado; no se pueden editar las respuestas');
    }

    return formExecutionModel.upsertAnswers(evaluation.formResponseId, answers);
  },

  finish: async (evaluationId: number, requesterId: number): Promise<FinishEvaluationResponse> => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (evaluation.technicianId !== requesterId) {
      throw ApiError.forbidden('Solo el técnico asignado puede finalizar esta evaluación');
    }
    if (evaluation.status !== 'EN_PROCESO') {
      throw ApiError.conflict('La evaluación debe estar en curso para finalizarla');
    }
    if (!evaluation.formResponseId) {
      throw ApiError.conflict('La evaluación no tiene una ficha diligenciada');
    }

    const formResponse = await prisma.formResponse.findUniqueOrThrow({ where: { formResponseId: evaluation.formResponseId } });
    const answers = (Array.isArray(formResponse.answers) ? formResponse.answers : []) as unknown as AskAnswer[];
    if (answers.length === 0) {
      throw ApiError.validation('No se puede finalizar una evaluación sin respuestas registradas');
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
