import type { ApiResponse, EvaluationReportDetail, ReviewReportRequest, ReportReview, CorrectReportRequest, FormAnswers, OfficialVerdictPreview } from '@reto/shared';
/** `GET /evaluations/:id/report` — Con acceso. Informe autogenerado al finalizar la evaluación. */
declare function getByEvaluation(evaluationId: number): Promise<ApiResponse<EvaluationReportDetail>>;
/**
 * `POST /reports/:id/submit` — TECNICO_EVALUADOR.
 * Envía a revisión: `status: 'BORRADOR' → 'ENVIADO'`, `locked = true`.
 */
declare function submit(reportId: number): Promise<ApiResponse<EvaluationReportDetail>>;
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
declare function review(reportId: number, body: ReviewReportRequest): Promise<ApiResponse<ReportReview>>;
/** `GET /reports/:id/reviews` — Con acceso. Historial de revisiones. */
declare function listReviews(reportId: number): Promise<ApiResponse<ReportReview[]>>;
/**
 * `POST /reports/:id/correct` — TECNICO_EVALUADOR. RF-18: edita el informe
 * tras una devolución. Incrementa `version`, `locked = false` mientras se corrige.
 *
 * @example
 * ```ts
 * await reportsService.correct(reportId, { noConformidades: 'Se corrige numeral 4.2 según hallazgo de revisión' });
 * ```
 */
declare function correct(reportId: number, body: CorrectReportRequest): Promise<ApiResponse<EvaluationReportDetail>>;
/**
 * `POST /reports/:id/resend` — TECNICO_EVALUADOR. Reenvía la corrección:
 * `status → 'ENVIADO'`, `locked = true`.
 */
declare function resend(reportId: number): Promise<ApiResponse<EvaluationReportDetail>>;
/**
 * `POST /evaluations/:id/verdict-preview`
 * Official verdict from the evaluation as it stands. Pass the answers on screen
 * so an inspector sees exactly what finishing or resubmitting will send.
 */
declare function preview(evaluationId: number, answers?: FormAnswers): Promise<ApiResponse<OfficialVerdictPreview>>;
export declare const reportsService: {
    getByEvaluation: typeof getByEvaluation;
    preview: typeof preview;
    submit: typeof submit;
    review: typeof review;
    listReviews: typeof listReviews;
    correct: typeof correct;
    resend: typeof resend;
};
export {};
