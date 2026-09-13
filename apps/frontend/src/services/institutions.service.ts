/**
 * institutions.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Empresas / Instituciones (RF-03).
 * Ver API_CONTRACTS.md, sección 3.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationQuery,
  InstitutionDetail,
  CreateInstitutionRequest,
  UpdateInstitutionRequest,
  Represent,
  CreateRepresentRequest,
  InstitutionHistoryResponse,
  EvaluationListItem,
} from '@reto/shared';

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
async function list(
  query?: ListInstitutionsQuery,
): Promise<ApiResponse<PaginatedResponse<InstitutionDetail>>> {
  const { data } = await httpClient.get<ApiResponse<PaginatedResponse<InstitutionDetail>>>(
    '/institutions',
    { params: query },
  );
  return data;
}

/** `GET /institutions/:id` — Roles con acceso a la empresa. Detalle + representantes + histórico resumido. */
async function getById(id: number): Promise<ApiResponse<InstitutionDetail>> {
  const { data } = await httpClient.get<ApiResponse<InstitutionDetail>>(`/institutions/${id}`);
  return data;
}

/** `GET /institutions/:id/history` — RF-03 "Consultar historial" (casos + evaluaciones + permisos). */
async function getHistory(id: number): Promise<ApiResponse<InstitutionHistoryResponse>> {
  const { data } = await httpClient.get<ApiResponse<InstitutionHistoryResponse>>(
    `/institutions/${id}/history`,
  );
  return data;
}

/** `GET /institutions/:id/evaluations` — RF-03 "Consultar evaluaciones previas". */
async function getEvaluations(
  id: number,
  query?: PaginationQuery,
): Promise<ApiResponse<PaginatedResponse<EvaluationListItem>>> {
  const { data } = await httpClient.get<ApiResponse<PaginatedResponse<EvaluationListItem>>>(
    `/institutions/${id}/evaluations`,
    { params: query },
  );
  return data;
}

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
async function create(body: CreateInstitutionRequest): Promise<ApiResponse<InstitutionDetail>> {
  const { data } = await httpClient.post<ApiResponse<InstitutionDetail>>('/institutions', body);
  return data;
}

/** `PATCH /institutions/:id` — ADMIN_EMPRESA, ADMIN. */
async function update(
  id: number,
  body: UpdateInstitutionRequest,
): Promise<ApiResponse<InstitutionDetail>> {
  const { data } = await httpClient.patch<ApiResponse<InstitutionDetail>>(
    `/institutions/${id}`,
    body,
  );
  return data;
}

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
async function addRepresentative(
  institutionId: number,
  body: CreateRepresentRequest,
): Promise<ApiResponse<Represent>> {
  const { data } = await httpClient.post<ApiResponse<Represent>>(
    `/institutions/${institutionId}/representatives`,
    body,
  );
  return data;
}

/** `PATCH /representatives/:id` — ADMIN_EMPRESA. */
async function updateRepresentative(
  id: number,
  body: Partial<CreateRepresentRequest>,
): Promise<ApiResponse<Represent>> {
  const { data } = await httpClient.patch<ApiResponse<Represent>>(`/representatives/${id}`, body);
  return data;
}

/** `DELETE /representatives/:id` — ADMIN_EMPRESA. */
async function deleteRepresentative(id: number): Promise<ApiResponse<{ id: number }>> {
  const { data } = await httpClient.delete<ApiResponse<{ id: number }>>(`/representatives/${id}`);
  return data;
}

/** `GET /catalogs/provinces` — Autenticado. */
async function listProvinces(): Promise<ApiResponse<Province[]>> {
  const { data } = await httpClient.get<ApiResponse<Province[]>>('/catalogs/provinces');
  return data;
}

/**
 * `GET /catalogs/municipalities?provinceId=` — Autenticado.
 *
 * @example
 * ```ts
 * const res = await institutionsService.listMunicipalities(2);
 * ```
 */
async function listMunicipalities(provinceId: number): Promise<ApiResponse<Municipality[]>> {
  const { data } = await httpClient.get<ApiResponse<Municipality[]>>('/catalogs/municipalities', {
    params: { provinceId },
  });
  return data;
}

export const institutionsService = {
  list,
  getById,
  getHistory,
  getEvaluations,
  create,
  update,
  addRepresentative,
  updateRepresentative,
  deleteRepresentative,
  listProvinces,
  listMunicipalities,
};
