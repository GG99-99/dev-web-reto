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
  /** Required when the coordinator returns the evaluation. */
  comments?: string;
  /**
   * DEVOLVER always reopens the whole record.
   * SOLICITAR_CORRECCION does the same only when this is true.
   */
  fullResubmission?: boolean;
  /**
   * Sections the evaluator may change on a partial return.
   * `report:<field>` or `chapter:<h1Id>`. Omitted partial returns
   * default to the four report narrative fields.
   */
  flaggedSections?: string[];
}

export const REPORT_NARRATIVE_SECTIONS = [
  { id: 'report:resumenEjecutivo', field: 'resumenEjecutivo', label: 'Executive summary' },
  { id: 'report:hallazgos', field: 'hallazgos', label: 'Findings' },
  { id: 'report:noConformidades', field: 'noConformidades', label: 'Non-conformities' },
  { id: 'report:recomendaciones', field: 'recomendaciones', label: 'Recommendations' },
] as const;

export type ReportNarrativeField = (typeof REPORT_NARRATIVE_SECTIONS)[number]['field'];

export function chapterSectionId(h1Id: number): string {
  return `chapter:${h1Id}`;
}

export type ReportWorkflowPhase =
  | 'draft'
  | 'awaiting_review'
  | 'returned_for_correction'
  | 'resubmitted'
  | 'approved';

/** User-facing phase of one evaluation report. Resubmission is the same report sent again. */
export function reportWorkflowPhase(report: {
  status?: string | null;
  reviews?: Array<{ action?: string | null }> | null;
}): ReportWorkflowPhase {
  const status = report.status;
  if (status === 'APROBADO') return 'approved';
  if (status === 'EN_CORRECCION' || status === 'DEVUELTO') return 'returned_for_correction';
  if (status === 'ENVIADO') {
    const returned = (report.reviews ?? []).some(
      (review) => review.action === 'DEVOLVER' || review.action === 'SOLICITAR_CORRECCION',
    );
    return returned ? 'resubmitted' : 'awaiting_review';
  }
  return 'draft';
}

export function reportWorkflowLabel(phase: ReportWorkflowPhase): string {
  switch (phase) {
    case 'awaiting_review':
      return 'Submitted, awaiting review';
    case 'returned_for_correction':
      return 'Returned for correction';
    case 'resubmitted':
      return 'Resubmitted after correction';
    case 'approved':
      return 'Approved and closed';
    default:
      return 'Draft';
  }
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
