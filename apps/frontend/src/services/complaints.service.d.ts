import type { ApiResponse, PaginatedResponse, PaginationQuery, Complaint, CreateComplaintRequest, SetComplaintResultRequest, Case } from '@reto/shared';
/** Filtros de `GET /complaints`, combinados con {@link PaginationQuery}. */
export interface ListComplaintsQuery extends PaginationQuery {
    resultado?: 'PROCEDE' | 'NO_PROCEDE' | 'REMISION_OTRO_PROCESO';
}
/** `GET /complaints` — COORDINADOR, ADMIN. */
declare function list(query?: ListComplaintsQuery): Promise<ApiResponse<PaginatedResponse<Complaint>>>;
/** `GET /complaints/:id` — COORDINADOR, ADMIN. */
declare function getById(id: number): Promise<ApiResponse<Complaint>>;
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
declare function create(body: CreateComplaintRequest): Promise<ApiResponse<Complaint>>;
/**
 * `PATCH /complaints/:id/resultado` — COORDINADOR.
 * Si el resultado es `'PROCEDE'`, se habilita {@link generateCase}.
 */
declare function setResult(id: number, body: SetComplaintResultRequest): Promise<ApiResponse<Complaint>>;
/**
 * `POST /complaints/:id/generate-case` — COORDINADOR.
 * Genera un `Case` con `origin = 'DENUNCIA'` cuando procede.
 */
declare function generateCase(id: number): Promise<ApiResponse<{
    case: Case;
}>>;
export declare const complaintsService: {
    list: typeof list;
    getById: typeof getById;
    create: typeof create;
    setResult: typeof setResult;
    generateCase: typeof generateCase;
};
export {};
