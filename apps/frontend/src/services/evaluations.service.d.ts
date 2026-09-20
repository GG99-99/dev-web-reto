import type { ApiResponse, PaginatedResponse, PaginationQuery, EvaluationListItem, CreateEvaluationRequest, RescheduleEvaluationRequest, CalendarQuery, CalendarResponse } from '@reto/shared';
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
declare function list(query?: ListEvaluationsQuery): Promise<ApiResponse<PaginatedResponse<EvaluationListItem>>>;
/** `GET /evaluations/:id` — Con acceso a la evaluación. */
declare function getById(id: number): Promise<ApiResponse<EvaluationListItem>>;
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
declare function create(body: CreateEvaluationRequest): Promise<ApiResponse<EvaluationListItem>>;
/** `PATCH /evaluations/:id/reschedule` — COORDINADOR. `status → 'REPROGRAMADA'`. */
declare function reschedule(id: number, body: RescheduleEvaluationRequest): Promise<ApiResponse<EvaluationListItem>>;
/** `POST /evaluations/:id/cancel` — COORDINADOR. `status → 'CANCELADA'`. */
declare function cancel(id: number): Promise<ApiResponse<EvaluationListItem>>;
/**
 * `GET /evaluations/calendar` — TECNICO_EVALUADOR. RF-11: vista día/semana/mes
 * del calendario propio del técnico.
 *
 * @example
 * ```ts
 * const res = await evaluationsService.getCalendar({ from: '2026-09-01', to: '2026-09-30', view: 'month' });
 * ```
 */
declare function getCalendar(query: CalendarQuery): Promise<ApiResponse<CalendarResponse>>;
export declare const evaluationsService: {
    list: typeof list;
    getById: typeof getById;
    create: typeof create;
    reschedule: typeof reschedule;
    cancel: typeof cancel;
    getCalendar: typeof getCalendar;
};
export {};
