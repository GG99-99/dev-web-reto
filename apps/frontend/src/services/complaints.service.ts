/**
 * complaints.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Denuncias (RF-09).
 * Ver API_CONTRACTS.md, sección 9.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationQuery,
  Complaint,
  CreateComplaintRequest,
  SetComplaintResultRequest,
  Case,
} from '@reto/shared';

/** Filtros de `GET /complaints`, combinados con {@link PaginationQuery}. */
export interface ListComplaintsQuery extends PaginationQuery {
  resultado?: 'PROCEDE' | 'NO_PROCEDE' | 'REMISION_OTRO_PROCESO';
}

/** `GET /complaints` — COORDINADOR, ADMIN. */
async function list(
  query?: ListComplaintsQuery,
): Promise<ApiResponse<PaginatedResponse<Complaint>>> {
  const { data } = await httpClient.get<ApiResponse<PaginatedResponse<Complaint>>>('/complaints', {
    params: query,
  });
  return data;
}

/** `GET /complaints/:id` — COORDINADOR, ADMIN. */
async function getById(id: number): Promise<ApiResponse<Complaint>> {
  const { data } = await httpClient.get<ApiResponse<Complaint>>(`/complaints/${id}`);
  return data;
}

/**
 * `POST /complaints` — COORDINADOR, ADMIN, o **Público** (formulario de
 * denuncia ciudadana sin autenticación).
 *
 * @example
 * ```ts
 * await complaintsService.create({
 *   tipoDenuncia: 'Condiciones sanitarias',
 *   fechaRecepcion: '2026-09-12',
 *   denunciante: 'Anónimo',
 *   descripcion: 'Manejo inadecuado de alimentos',
 *   institutionId: 7,
 * });
 * ```
 */
async function create(body: CreateComplaintRequest): Promise<ApiResponse<Complaint>> {
  const { data } = await httpClient.post<ApiResponse<Complaint>>('/complaints', body);
  return data;
}

/**
 * `PATCH /complaints/:id/resultado` — COORDINADOR.
 * Si el resultado es `'PROCEDE'`, se habilita {@link generateCase}.
 */
async function setResult(
  id: number,
  body: SetComplaintResultRequest,
): Promise<ApiResponse<Complaint>> {
  const { data } = await httpClient.patch<ApiResponse<Complaint>>(
    `/complaints/${id}/resultado`,
    body,
  );
  return data;
}

/**
 * `POST /complaints/:id/generate-case` — COORDINADOR.
 * Genera un `Case` con `origin = 'DENUNCIA'` cuando procede.
 */
async function generateCase(id: number): Promise<ApiResponse<{ case: Case }>> {
  const { data } = await httpClient.post<ApiResponse<{ case: Case }>>(
    `/complaints/${id}/generate-case`,
  );
  return data;
}

export const complaintsService = {
  list,
  getById,
  create,
  setResult,
  generateCase,
};
