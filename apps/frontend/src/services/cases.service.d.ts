import type { ApiResponse, PaginatedResponse, PaginationQuery, CaseDetail, CreateInstitutionalCaseRequest, CloseCaseRequest, CloseCaseResponse } from '@reto/shared';
/** Filtros de `GET /cases`, combinados con {@link PaginationQuery}. */
export interface ListCasesQuery extends PaginationQuery {
    origin?: 'SOLICITUD_EMPRESA' | 'PROGRAMACION_INSTITUCIONAL' | 'ALERTA_LAPCH' | 'DENUNCIA';
    status?: string;
    priority?: 'BAJA' | 'MEDIA' | 'ALTA';
    institutionId?: number;
    technicianId?: number;
}
/** `GET /cases` — COORDINADOR, ADMIN. */
declare function list(query?: ListCasesQuery): Promise<ApiResponse<PaginatedResponse<CaseDetail>>>;
/** `GET /cases/:id` — COORDINADOR, técnico asignado, ADMIN. Detalle completo. */
declare function getById(id: number): Promise<ApiResponse<CaseDetail>>;
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
declare function createInstitutional(body: CreateInstitutionalCaseRequest): Promise<ApiResponse<CaseDetail>>;
/** `PATCH /cases/:id/priority` — COORDINADOR. */
declare function updatePriority(id: number, priority: 'BAJA' | 'MEDIA' | 'ALTA'): Promise<ApiResponse<CaseDetail>>;
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
declare function close(id: number, body: CloseCaseRequest): Promise<ApiResponse<CloseCaseResponse>>;
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
declare function downloadClosePdf(id: number): Promise<Blob>;
export declare const casesService: {
    list: typeof list;
    getById: typeof getById;
    createInstitutional: typeof createInstitutional;
    updatePriority: typeof updatePriority;
    close: typeof close;
    downloadClosePdf: typeof downloadClosePdf;
};
export {};
