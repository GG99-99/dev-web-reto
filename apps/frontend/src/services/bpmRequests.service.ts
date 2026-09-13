/**
 * bpmRequests.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Solicitudes BPM (RF-05).
 * Ver API_CONTRACTS.md, sección 5.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationQuery,
  BpmRequestListItem,
  BpmRequestDetail,
  CreateBpmRequestRequest,
  UpdateBpmRequestRequest,
  SubmitBpmRequestResponse,
  Attachment,
} from '@reto/shared';

/** Filtros de `GET /bpm-requests`, combinados con {@link PaginationQuery}. */
export interface ListBpmRequestsQuery extends PaginationQuery {
  status?: string;
  institutionId?: number;
}

/** `GET /bpm-requests` — ADMIN_EMPRESA, USUARIO_DELEGADO, COORDINADOR. */
async function list(
  query?: ListBpmRequestsQuery,
): Promise<ApiResponse<PaginatedResponse<BpmRequestListItem>>> {
  const { data } = await httpClient.get<ApiResponse<PaginatedResponse<BpmRequestListItem>>>(
    '/bpm-requests',
    { params: query },
  );
  return data;
}

/** `GET /bpm-requests/:id` — Autor de la empresa, COORDINADOR. */
async function getById(id: number): Promise<ApiResponse<BpmRequestDetail>> {
  const { data } = await httpClient.get<ApiResponse<BpmRequestDetail>>(`/bpm-requests/${id}`);
  return data;
}

/**
 * `POST /bpm-requests` — ADMIN_EMPRESA, USUARIO_DELEGADO. Se crea con `status = 'BORRADOR'`.
 *
 * @example
 * ```ts
 * const res = await bpmRequestsService.create({
 *   institutionId: 7,
 *   tipoEstablecimiento: 'Planta procesadora',
 *   motivo: 'Renovación de permiso sanitario',
 * });
 * ```
 */
async function create(body: CreateBpmRequestRequest): Promise<ApiResponse<BpmRequestDetail>> {
  const { data } = await httpClient.post<ApiResponse<BpmRequestDetail>>('/bpm-requests', body);
  return data;
}

/** `PATCH /bpm-requests/:id` — Autor, solo mientras `status === 'BORRADOR'`. */
async function update(
  id: number,
  body: UpdateBpmRequestRequest,
): Promise<ApiResponse<BpmRequestDetail>> {
  const { data } = await httpClient.patch<ApiResponse<BpmRequestDetail>>(
    `/bpm-requests/${id}`,
    body,
  );
  return data;
}

/**
 * `POST /bpm-requests/:id/attachments` — Autor. Adjunta documentación
 * obligatoria (`multipart/form-data`).
 *
 * @example
 * ```ts
 * await bpmRequestsService.addAttachment(bpmRequestId, fileInput.files[0]);
 * ```
 */
async function addAttachment(id: number, file: File): Promise<ApiResponse<Attachment>> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await httpClient.post<ApiResponse<Attachment>>(
    `/bpm-requests/${id}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

/**
 * `POST /bpm-requests/:id/submit` — Autor. Envía la solicitud:
 * `BORRADOR → PENDIENTE_ASIGNACION` y crea un `Case` con `origin = 'SOLICITUD_EMPRESA'`.
 *
 * @example
 * ```ts
 * const res = await bpmRequestsService.submit(bpmRequestId);
 * if (res.valid) navigateTo(`/cases/${res.data.case.caseId}`);
 * ```
 */
async function submit(id: number): Promise<ApiResponse<SubmitBpmRequestResponse>> {
  const { data } = await httpClient.post<ApiResponse<SubmitBpmRequestResponse>>(
    `/bpm-requests/${id}/submit`,
  );
  return data;
}

export const bpmRequestsService = {
  list,
  getById,
  create,
  update,
  addAttachment,
  submit,
};
