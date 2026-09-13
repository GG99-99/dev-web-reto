/**
 * evaluations.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Programación de Evaluaciones (RF-07) y
 * Calendario (RF-11).
 * Ver API_CONTRACTS.md, sección 7.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationQuery,
  EvaluationListItem,
  CreateEvaluationRequest,
  RescheduleEvaluationRequest,
  CalendarQuery,
  CalendarResponse,
} from '@reto/shared';

/** Filtros de `GET /evaluations`, combinados con {@link PaginationQuery}. */
export interface ListEvaluationsQuery extends PaginationQuery {
  status?: string;
  technicianId?: number;
  institutionId?: number;
  /** Rango de fechas — filtro `scheduledDate >= from`. */
  from?: string;
  /** Rango de fechas — filtro `scheduledDate <= to`. */
  to?: string;
}

/** `GET /evaluations` — COORDINADOR, TECNICO_EVALUADOR (propias). */
async function list(
  query?: ListEvaluationsQuery,
): Promise<ApiResponse<PaginatedResponse<EvaluationListItem>>> {
  const { data } = await httpClient.get<ApiResponse<PaginatedResponse<EvaluationListItem>>>(
    '/evaluations',
    { params: query },
  );
  return data;
}

/** `GET /evaluations/:id` — Con acceso a la evaluación. */
async function getById(id: number): Promise<ApiResponse<EvaluationListItem>> {
  const { data } = await httpClient.get<ApiResponse<EvaluationListItem>>(`/evaluations/${id}`);
  return data;
}

/**
 * `POST /evaluations` — COORDINADOR. Programa una evaluación sobre un `Case` existente.
 *
 * @example
 * ```ts
 * const res = await evaluationsService.create({
 *   caseId: 15,
 *   technicianId: 3,
 *   scheduledDate: '2026-09-20T13:00:00.000Z',
 *   priority: 'ALTA',
 * });
 * ```
 */
async function create(body: CreateEvaluationRequest): Promise<ApiResponse<EvaluationListItem>> {
  const { data } = await httpClient.post<ApiResponse<EvaluationListItem>>('/evaluations', body);
  return data;
}

/** `PATCH /evaluations/:id/reschedule` — COORDINADOR. `status → 'REPROGRAMADA'`. */
async function reschedule(
  id: number,
  body: RescheduleEvaluationRequest,
): Promise<ApiResponse<EvaluationListItem>> {
  const { data } = await httpClient.patch<ApiResponse<EvaluationListItem>>(
    `/evaluations/${id}/reschedule`,
    body,
  );
  return data;
}

/** `POST /evaluations/:id/cancel` — COORDINADOR. `status → 'CANCELADA'`. */
async function cancel(id: number): Promise<ApiResponse<EvaluationListItem>> {
  const { data } = await httpClient.post<ApiResponse<EvaluationListItem>>(
    `/evaluations/${id}/cancel`,
  );
  return data;
}

/**
 * `GET /evaluations/calendar` — TECNICO_EVALUADOR. RF-11: vista día/semana/mes
 * del calendario propio del técnico.
 *
 * @example
 * ```ts
 * const res = await evaluationsService.getCalendar({ from: '2026-09-01', to: '2026-09-30', view: 'month' });
 * ```
 */
async function getCalendar(query: CalendarQuery): Promise<ApiResponse<CalendarResponse>> {
  const { data } = await httpClient.get<ApiResponse<CalendarResponse>>('/evaluations/calendar', {
    params: query,
  });
  return data;
}

export const evaluationsService = {
  list,
  getById,
  create,
  reschedule,
  cancel,
  getCalendar,
};
