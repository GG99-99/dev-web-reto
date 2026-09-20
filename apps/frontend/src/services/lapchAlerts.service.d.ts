import type { ApiResponse, PaginatedResponse, PaginationQuery, LapchAlert, CreateLapchAlertRequest, SetLapchResultRequest, GenerateCaseFromAlertResponse } from '@reto/shared';
/** Filtros de `GET /lapch-alerts`, combinados con {@link PaginationQuery}. */
export interface ListLapchAlertsQuery extends PaginationQuery {
    resultado?: 'PROCEDE' | 'NO_PROCEDE';
}
/** `GET /lapch-alerts` — COORDINADOR, ADMIN. */
declare function list(query?: ListLapchAlertsQuery): Promise<ApiResponse<PaginatedResponse<LapchAlert>>>;
/** `GET /lapch-alerts/:id` — COORDINADOR, ADMIN. */
declare function getById(id: number): Promise<ApiResponse<LapchAlert>>;
/**
 * `POST /lapch-alerts` — COORDINADOR, ADMIN.
 *
 * @example
 * ```ts
 * await lapchAlertsService.create({
 *   institutionId: 7,
 *   numeroAlerta: 'LAPCH-2026-0451',
 *   fecha: '2026-09-10',
 *   producto: 'Queso fresco',
 *   descripcion: 'Presencia de Listeria monocytogenes',
 * });
 * ```
 */
declare function create(body: CreateLapchAlertRequest): Promise<ApiResponse<LapchAlert>>;
/**
 * `PATCH /lapch-alerts/:id/resultado` — COORDINADOR.
 * Si el resultado es `'PROCEDE'`, se habilita {@link generateCase}.
 */
declare function setResult(id: number, body: SetLapchResultRequest): Promise<ApiResponse<LapchAlert>>;
/**
 * `POST /lapch-alerts/:id/generate-case` — COORDINADOR.
 * Genera un `Case` con `origin = 'ALERTA_LAPCH'` cuando `resultado = 'PROCEDE'`.
 */
declare function generateCase(id: number): Promise<ApiResponse<GenerateCaseFromAlertResponse>>;
/** `POST /lapch-alerts/:id/close` — COORDINADOR. Cierra la alerta sin generar evaluación. */
declare function close(id: number): Promise<ApiResponse<LapchAlert>>;
export declare const lapchAlertsService: {
    list: typeof list;
    getById: typeof getById;
    create: typeof create;
    setResult: typeof setResult;
    generateCase: typeof generateCase;
    close: typeof close;
};
export {};
