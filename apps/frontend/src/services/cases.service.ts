/**
 * cases.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Casos / Expedientes (RF-06, RF-19).
 * Ver API_CONTRACTS.md, sección 6.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationQuery,
  CaseDetail,
  CreateInstitutionalCaseRequest,
  CloseCaseRequest,
  CloseCaseResponse,
} from '@reto/shared';

/** Filtros de `GET /cases`, combinados con {@link PaginationQuery}. */
export interface ListCasesQuery extends PaginationQuery {
  origin?: 'SOLICITUD_EMPRESA' | 'PROGRAMACION_INSTITUCIONAL' | 'ALERTA_LAPCH' | 'DENUNCIA';
  status?: string;
  priority?: 'BAJA' | 'MEDIA' | 'ALTA';
  institutionId?: number;
  technicianId?: number;
}

/** `GET /cases` — COORDINADOR, ADMIN. */
async function list(query?: ListCasesQuery): Promise<ApiResponse<PaginatedResponse<CaseDetail>>> {
  const { data } = await httpClient.get<ApiResponse<PaginatedResponse<CaseDetail>>>('/cases', {
    params: query,
  });
  return data;
}

/** `GET /cases/:id` — COORDINADOR, técnico asignado, ADMIN. Detalle completo. */
async function getById(id: number): Promise<ApiResponse<CaseDetail>> {
  const { data } = await httpClient.get<ApiResponse<CaseDetail>>(`/cases/${id}`);
  return data;
}

/**
 * `POST /cases` — COORDINADOR. Origina un caso por **programación
 * institucional** directa (`origin = 'PROGRAMACION_INSTITUCIONAL'`).
 *
 * @example
 * ```ts
 * const res = await casesService.createInstitutional({
 *   institutionId: 7,
 *   priority: 'MEDIA',
 *   motivo: 'Inspección de rutina anual',
 * });
 * ```
 */
async function createInstitutional(
  body: CreateInstitutionalCaseRequest,
): Promise<ApiResponse<CaseDetail>> {
  const { data } = await httpClient.post<ApiResponse<CaseDetail>>('/cases', body);
  return data;
}

/** `PATCH /cases/:id/priority` — COORDINADOR. */
async function updatePriority(
  id: number,
  priority: 'BAJA' | 'MEDIA' | 'ALTA',
): Promise<ApiResponse<CaseDetail>> {
  const { data } = await httpClient.patch<ApiResponse<CaseDetail>>(`/cases/${id}/priority`, {
    priority,
  });
  return data;
}

/**
 * `POST /cases/:id/close` — COORDINADOR. RF-19: cierre de expediente.
 * El caso resultante queda `status = 'CERRADO'` con `closedAt` seteado.
 *
 * @example
 * ```ts
 * const res = await casesService.close(caseId, { resultadoFinal: 'Cumple BPM', emitirInforme: true });
 * if (res.valid && res.data.informeOficialUrl) window.open(res.data.informeOficialUrl);
 * ```
 */
async function close(id: number, body: CloseCaseRequest): Promise<ApiResponse<CloseCaseResponse>> {
  const { data } = await httpClient.post<ApiResponse<CloseCaseResponse>>(`/cases/${id}/close`, body);
  return data;
}

/**
 * `GET /cases/:id/close/pdf` — COORDINADOR, ADMIN_EMPRESA (de esa empresa).
 * Descarga binaria del informe oficial en PDF.
 *
 * @example
 * ```ts
 * const blob = await casesService.downloadClosePdf(caseId);
 * const url = URL.createObjectURL(blob);
 * window.open(url);
 * ```
 */
async function downloadClosePdf(id: number): Promise<Blob> {
  const { data } = await httpClient.get<Blob>(`/cases/${id}/close/pdf`, {
    responseType: 'blob',
  });
  return data;
}

export const casesService = {
  list,
  getById,
  createInstitutional,
  updatePriority,
  close,
  downloadClosePdf,
};
