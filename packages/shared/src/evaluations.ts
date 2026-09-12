/**
 * evaluations.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Programación de Evaluaciones (RF-07) y Calendario (RF-11).
 * Endpoints: /evaluations, /evaluations/:id, /evaluations/:id/reschedule,
 * /evaluations/:id/cancel, /evaluations/calendar
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db'

/**
 * Modelo plano de `Evaluation`, generado por Prisma. Building block usado
 * por dashboard, cases, calendar y history.
 */
export type Evaluation = Prisma.EvaluationGetPayload<{}>;

/**
 * Item de listado de evaluaciones, con datos mínimos de institución y el
 * técnico asignado (con su `Person`). Respuesta de `GET /evaluations`.
 */
export type EvaluationListItem = Prisma.EvaluationGetPayload<{
  include: {
    institution: { select: { institutionId: true; name: true; streetName: true } };
    technician: { include: { person: true } };
  };
}>;

/**
 * Body de `POST /evaluations` (COORDINADOR programa una evaluación sobre
 * un `Case` existente).
 *
 * @example
 * ```ts
 * const body: CreateEvaluationRequest = {
 *   caseId: 15,
 *   technicianId: 3,
 *   scheduledDate: '2026-09-20T13:00:00.000Z',
 *   priority: 'ALTA',
 * };
 * ```
 */
export interface CreateEvaluationRequest {
  caseId: number;
  technicianId: number;
  /** Fecha/hora programada en formato ISO 8601. */
  scheduledDate: string;
  reason?: string;
  priority: 'BAJA' | 'MEDIA' | 'ALTA';
  observations?: string;
}

/**
 * Body de `PATCH /evaluations/:id/reschedule`.
 * Al aplicarse, la evaluación pasa a `status = 'REPROGRAMADA'`.
 */
export interface RescheduleEvaluationRequest {
  scheduledDate: string;
  observations?: string;
}

/**
 * Query de `GET /evaluations/calendar` (RF-11: vista día/semana/mes del
 * calendario propio del técnico).
 *
 * @example
 * ```ts
 * const query: CalendarQuery = { from: '2026-09-01', to: '2026-09-30', view: 'month' };
 * ```
 */
export interface CalendarQuery {
  /** Fecha de inicio del rango, formato ISO (solo fecha). */
  from: string;
  /** Fecha de fin del rango, formato ISO (solo fecha). */
  to: string;
  view: 'day' | 'week' | 'month';
}

/** Respuesta de `GET /evaluations/calendar`: vista aligerada para pintar el calendario. */
export type CalendarResponse = Pick<
  Evaluation,
  'evaluationId' | 'scheduledDate' | 'status' | 'institutionId'
>[];
