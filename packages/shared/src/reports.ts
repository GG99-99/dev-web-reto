/**
 * reports.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Informe de Evaluación (RF-16), Revisión (RF-17) y
 * Correcciones (RF-18).
 *
 * Endpoints: /evaluations/:id/report, /reports/:id/submit,
 * /reports/:id/review, /reports/:id/reviews, /reports/:id/correct,
 * /reports/:id/resend
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';

/** Modelo plano de `EvaluationReport`, generado por Prisma. */
export type EvaluationReport = Prisma.EvaluationReportGetPayload<{}>;

/**
 * Detalle completo de un informe: adjuntos y su historial de revisiones
 * (cada revisión con el `Coordinador` y su `Person` incluidos).
 * Respuesta de `GET /evaluations/:id/report` (autogenerado al finalizar la evaluación).
 */
export type EvaluationReportDetail = Prisma.EvaluationReportGetPayload<{
  include: {
    attachments: true;
    reviews: { include: { coordinator: { include: { person: true } } } };
  };
}>;

/**
 * Body de `POST /reports/:id/review` (RF-17).
 *
 * @example
 * ```ts
 * const body: ReviewReportRequest = { action: 'SOLICITAR_CORRECCION', comments: 'Falta anexar evidencia fotográfica del área 3' };
 * ```
 */
export interface ReviewReportRequest {
  action: 'APROBAR' | 'DEVOLVER' | 'SOLICITAR_CORRECCION';
  comments?: string;
}

/**
 * Registro individual del historial de revisiones de un informe.
 * Respuesta de `GET /reports/:id/reviews`.
 */
export type ReportReview = Prisma.ReportReviewGetPayload<{}>;

/**
 * Body de `POST /reports/:id/correct` (RF-18: el técnico edita el informe
 * tras una devolución). Al aplicarse, incrementa `EvaluationReport.version`
 * y mantiene `locked = false` mientras dura la corrección.
 *
 * @remarks
 * Reenviar la corrección se hace luego con `POST /reports/:id/resend`, lo
 * que vuelve a poner `status = 'ENVIADO'` y `locked = true`.
 *
 * @example
 * ```ts
 * const body: CorrectReportRequest = {
 *   noConformidades: 'Se corrige numeral 4.2 según hallazgo de revisión',
 * };
 * ```
 */
export interface CorrectReportRequest {
  resumenEjecutivo?: string;
  hallazgos?: string;
  noConformidades?: string;
  recomendaciones?: string;
}

/**
 * Restricción de negocio (RF-17): el backend debe rechazar (`403`, código
 * `FORBIDDEN`) cualquier `PATCH /evaluations/:id/answers` sobre una
 * evaluación cuyo `EvaluationReport.locked` sea `true`.
 */
