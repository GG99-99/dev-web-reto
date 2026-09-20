import type { ApiResponse, PaginatedResponse, PaginationQuery, BpmRequestListItem, BpmRequestDetail, CreateBpmRequestRequest, UpdateBpmRequestRequest, SubmitBpmRequestResponse, Attachment } from '@reto/shared';
/** Filtros de `GET /bpm-requests`, combinados con {@link PaginationQuery}. */
export interface ListBpmRequestsQuery extends PaginationQuery {
    status?: string;
    institutionId?: number;
}
/** `GET /bpm-requests` — ADMIN_EMPRESA, USUARIO_DELEGADO, COORDINADOR. */
declare function list(query?: ListBpmRequestsQuery): Promise<ApiResponse<PaginatedResponse<BpmRequestListItem>>>;
/** `GET /bpm-requests/:id` — Autor de la empresa, COORDINADOR. */
declare function getById(id: number): Promise<ApiResponse<BpmRequestDetail>>;
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
declare function create(body: CreateBpmRequestRequest): Promise<ApiResponse<BpmRequestDetail>>;
/** `PATCH /bpm-requests/:id` — Autor, solo mientras `status === 'BORRADOR'`. */
declare function update(id: number, body: UpdateBpmRequestRequest): Promise<ApiResponse<BpmRequestDetail>>;
/**
 * `POST /bpm-requests/:id/attachments` — Autor. Adjunta documentación
 * obligatoria (`multipart/form-data`).
 *
 * @example
 * ```ts
 * await bpmRequestsService.addAttachment(bpmRequestId, fileInput.files[0]);
 * ```
 */
declare function addAttachment(id: number, file: File): Promise<ApiResponse<Attachment>>;
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
declare function submit(id: number): Promise<ApiResponse<SubmitBpmRequestResponse>>;
export declare const bpmRequestsService: {
    list: typeof list;
    getById: typeof getById;
    create: typeof create;
    update: typeof update;
    addAttachment: typeof addAttachment;
    submit: typeof submit;
};
export {};
