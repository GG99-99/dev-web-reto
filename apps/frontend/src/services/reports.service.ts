/**
 * reports.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Informe de Evaluación (RF-16),
 * Revisión (RF-17) y Correcciones (RF-18).
 * Ver API_CONTRACTS.md, sección 14.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  EvaluationReportDetail,
  ReviewReportRequest,
  ReportReview,
  CorrectReportRequest,
} from '@reto/shared';

/** `GET /evaluations/:id/report` — Con acceso. Informe autogenerado al finalizar la evaluación. */
async function getByEvaluation(evaluationId: number): Promise<ApiResponse<EvaluationReportDetail>> {
  const { data } = await httpClient.get<ApiResponse<EvaluationReportDetail>>(
    `/evaluations/${evaluationId}/report`,
  );
  return data;
}

/**
 * `POST /reports/:id/submit` — TECNICO_EVALUADOR.
 * Envía a revisión: `status: 'BORRADOR' → 'ENVIADO'`, `locked = true`.
 */
async function submit(reportId: number): Promise<ApiResponse<EvaluationReportDetail>> {
  const { data } = await httpClient.post<ApiResponse<EvaluationReportDetail>>(
    `/reports/${reportId}/submit`,
  );
  return data;
}

/**
 * `POST /reports/:id/review` — COORDINADOR. RF-17: aprobar / devolver / solicitar corrección.
 *
 * @example
 * ```ts
 * await reportsService.review(reportId, {
 *   action: 'SOLICITAR_CORRECCION',
 *   comments: 'Falta anexar evidencia fotográfica del área 3',
 * });
 * ```
 */
async function review(
  reportId: number,
  body: ReviewReportRequest,
): Promise<ApiResponse<ReportReview>> {
  const { data } = await httpClient.post<ApiResponse<ReportReview>>(
    `/reports/${reportId}/review`,
    body,
  );
  return data;
}

/** `GET /reports/:id/reviews` — Con acceso. Historial de revisiones. */
async function listReviews(reportId: number): Promise<ApiResponse<ReportReview[]>> {
  const { data } = await httpClient.get<ApiResponse<ReportReview[]>>(
    `/reports/${reportId}/reviews`,
  );
  return data;
}

/**
 * `POST /reports/:id/correct` — TECNICO_EVALUADOR. RF-18: edita el informe
 * tras una devolución. Incrementa `version`, `locked = false` mientras se corrige.
 *
 * @example
 * ```ts
 * await reportsService.correct(reportId, { noConformidades: 'Se corrige numeral 4.2 según hallazgo de revisión' });
 * ```
 */
async function correct(
  reportId: number,
  body: CorrectReportRequest,
): Promise<ApiResponse<EvaluationReportDetail>> {
  const { data } = await httpClient.post<ApiResponse<EvaluationReportDetail>>(
    `/reports/${reportId}/correct`,
    body,
  );
  return data;
}

/**
 * `POST /reports/:id/resend` — TECNICO_EVALUADOR. Reenvía la corrección:
 * `status → 'ENVIADO'`, `locked = true`.
 */
async function resend(reportId: number): Promise<ApiResponse<EvaluationReportDetail>> {
  const { data } = await httpClient.post<ApiResponse<EvaluationReportDetail>>(
    `/reports/${reportId}/resend`,
  );
  return data;
}

export const reportsService = {
  getByEvaluation,
  submit,
  review,
  listReviews,
  correct,
  resend,
};
