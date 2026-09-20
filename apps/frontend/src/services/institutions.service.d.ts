import type { ApiResponse, PaginatedResponse, PaginationQuery, InstitutionDetail, CreateInstitutionRequest, UpdateInstitutionRequest, Represent, CreateRepresentRequest, InstitutionHistoryResponse, EvaluationListItem } from '@reto/shared';
/**
 * Provincia / municipio del catálogo geográfico.
 *
 * @remarks
 * No están declarados en `API_CONTRACTS.md` más allá de mencionarse como
 * `Prisma.ProvinceGetPayload<{}>` / `Prisma.MunicipalityGetPayload<{}>`
 * implícitos; se definen aquí con los campos mínimos esperables. Ajusta
 * según tu `schema.prisma` si difiere.
 */
export interface Province {
    provinceId: number;
    name: string;
}
export interface Municipality {
    municipalityId: number;
    provinceId: number;
    name: string;
}
/** Filtros de `GET /institutions`, combinados con {@link PaginationQuery}. */
export interface ListInstitutionsQuery extends PaginationQuery {
    provinceId?: number;
    municipalityId?: number;
    rnc?: string;
    /** Búsqueda libre por nombre / nombre comercial. */
    q?: string;
}
/** `GET /institutions` — ADMIN, COORDINADOR. */
declare function list(query?: ListInstitutionsQuery): Promise<ApiResponse<PaginatedResponse<InstitutionDetail>>>;
/** `GET /institutions/:id` — Roles con acceso a la empresa. Detalle + representantes + histórico resumido. */
declare function getById(id: number): Promise<ApiResponse<InstitutionDetail>>;
/** `GET /institutions/:id/history` — RF-03 "Consultar historial" (casos + evaluaciones + permisos). */
declare function getHistory(id: number): Promise<ApiResponse<InstitutionHistoryResponse>>;
/** `GET /institutions/:id/evaluations` — RF-03 "Consultar evaluaciones previas". */
declare function getEvaluations(id: number, query?: PaginationQuery): Promise<ApiResponse<PaginatedResponse<EvaluationListItem>>>;
/**
 * `POST /institutions` — ADMIN_EMPRESA. Registra una nueva empresa.
 *
 * @example
 * ```ts
 * const res = await institutionsService.create({
 *   name: 'Lácteos del Cibao SRL',
 *   streetName: 'Av. Estrella Sadhalá',
 *   streetNum: '45',
 *   phoneNumber: '8095551234',
 *   email: 'contacto@lacteoscibao.do',
 *   rnc: '130123456',
 *   nombreComercial: 'Lácteos Cibao',
 *   actividadEconomica: 'Procesamiento de lácteos',
 *   municipalityId: 12,
 * });
 * ```
 */
declare function create(body: CreateInstitutionRequest): Promise<ApiResponse<InstitutionDetail>>;
/** `PATCH /institutions/:id` — ADMIN_EMPRESA, ADMIN. */
declare function update(id: number, body: UpdateInstitutionRequest): Promise<ApiResponse<InstitutionDetail>>;
/**
 * `POST /institutions/:id/representatives` — ADMIN_EMPRESA.
 *
 * @example
 * ```ts
 * await institutionsService.addRepresentative(institutionId, {
 *   person: { name: 'Juan Gómez', cedula: '001-9876543-2', phone: '8299876543', email: 'juan@empresa.com' },
 *   type: 'LEGAL',
 * });
 * ```
 */
declare function addRepresentative(institutionId: number, body: CreateRepresentRequest): Promise<ApiResponse<Represent>>;
/** `PATCH /representatives/:id` — ADMIN_EMPRESA. */
declare function updateRepresentative(id: number, body: Partial<CreateRepresentRequest>): Promise<ApiResponse<Represent>>;
/** `DELETE /representatives/:id` — ADMIN_EMPRESA. */
declare function deleteRepresentative(id: number): Promise<ApiResponse<{
    id: number;
}>>;
/** `GET /catalogs/provinces` — Autenticado. */
declare function listProvinces(): Promise<ApiResponse<Province[]>>;
/**
 * `GET /catalogs/municipalities?provinceId=` — Autenticado.
 *
 * @example
 * ```ts
 * const res = await institutionsService.listMunicipalities(2);
 * ```
 */
declare function listMunicipalities(provinceId: number): Promise<ApiResponse<Municipality[]>>;
export declare const institutionsService: {
    list: typeof list;
    getById: typeof getById;
    getHistory: typeof getHistory;
    getEvaluations: typeof getEvaluations;
    create: typeof create;
    update: typeof update;
    addRepresentative: typeof addRepresentative;
    updateRepresentative: typeof updateRepresentative;
    deleteRepresentative: typeof deleteRepresentative;
    listProvinces: typeof listProvinces;
    listMunicipalities: typeof listMunicipalities;
};
export {};
