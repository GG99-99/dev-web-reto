/**
 * lapchAlerts.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Alertas LAPCH (RF-08).
 * Ver API_CONTRACTS.md, sección 8.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationQuery,
  LapchAlert,
  CreateLapchAlertRequest,
  SetLapchResultRequest,
  GenerateCaseFromAlertResponse,
} from '@reto/shared';

/** Filtros de `GET /lapch-alerts`, combinados con {@link PaginationQuery}. */
export interface ListLapchAlertsQuery extends PaginationQuery {
  resultado?: 'PROCEDE' | 'NO_PROCEDE';
}

/** `GET /lapch-alerts` — COORDINADOR, ADMIN. */
async function list(
  query?: ListLapchAlertsQuery,
): Promise<ApiResponse<PaginatedResponse<LapchAlert>>> {
  const { data } = await httpClient.get<ApiResponse<PaginatedResponse<LapchAlert>>>(
    '/lapch-alerts',
    { params: query },
  );
  return data;
}

/** `GET /lapch-alerts/:id` — COORDINADOR, ADMIN. */
async function getById(id: number): Promise<ApiResponse<LapchAlert>> {
  const { data } = await httpClient.get<ApiResponse<LapchAlert>>(`/lapch-alerts/${id}`);
  return data;
}

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
async function create(body: CreateLapchAlertRequest): Promise<ApiResponse<LapchAlert>> {
  const { data } = await httpClient.post<ApiResponse<LapchAlert>>('/lapch-alerts', body);
  return data;
}

/**
 * `PATCH /lapch-alerts/:id/resultado` — COORDINADOR.
 * Si el resultado es `'PROCEDE'`, se habilita {@link generateCase}.
 */
async function setResult(
  id: number,
  body: SetLapchResultRequest,
): Promise<ApiResponse<LapchAlert>> {
  const { data } = await httpClient.patch<ApiResponse<LapchAlert>>(
    `/lapch-alerts/${id}/resultado`,
    body,
  );
  return data;
}

/**
 * `POST /lapch-alerts/:id/generate-case` — COORDINADOR.
 * Genera un `Case` con `origin = 'ALERTA_LAPCH'` cuando `resultado = 'PROCEDE'`.
 */
async function generateCase(id: number): Promise<ApiResponse<GenerateCaseFromAlertResponse>> {
  const { data } = await httpClient.post<ApiResponse<GenerateCaseFromAlertResponse>>(
    `/lapch-alerts/${id}/generate-case`,
  );
  return data;
}

/** `POST /lapch-alerts/:id/close` — COORDINADOR. Cierra la alerta sin generar evaluación. */
async function close(id: number): Promise<ApiResponse<LapchAlert>> {
  const { data } = await httpClient.post<ApiResponse<LapchAlert>>(`/lapch-alerts/${id}/close`);
  return data;
}

export const lapchAlertsService = {
  list,
  getById,
  create,
  setResult,
  generateCase,
  close,
};
