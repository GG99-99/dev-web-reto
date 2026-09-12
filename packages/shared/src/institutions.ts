/**
 * institutions.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Empresas / Instituciones (RF-03).
 * Endpoints: /institutions, /institutions/:id, /institutions/:id/history,
 * /institutions/:id/evaluations, /institutions/:id/representatives,
 * /representatives/:id, /catalogs/provinces, /catalogs/municipalities
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';
import type { Case } from './cases';
import type { EvaluationListItem } from './evaluations';

/**
 * Modelo plano de `Institution`, generado por Prisma. Building block usado
 * por history, dashboard y otros módulos que solo necesitan campos básicos
 * (ej. `Pick<Institution, 'institutionId' | 'name'>`).
 */
export type Institution = Prisma.InstitutionGetPayload<{}>;

/**
 * Detalle completo de una institución: municipio (con provincia),
 * representantes (con persona) y propietario (con persona).
 * Usado como respuesta de `GET /institutions/:id`.
 */
export type InstitutionDetail = Prisma.InstitutionGetPayload<{
  include: {
    municipality: { include: { province: true } };
    representantes: { include: { person: true } };
    propietary: { include: { person: true } };
  };
}>;

/**
 * Body de `POST /institutions` (registro de empresa por ADMIN_EMPRESA).
 *
 * @example
 * ```ts
 * const body: CreateInstitutionRequest = {
 *   name: 'Lácteos del Cibao SRL',
 *   streetName: 'Av. Estrella Sadhalá',
 *   streetNum: '45',
 *   phoneNumber: '8095551234',
 *   email: 'contacto@lacteoscibao.do',
 *   rnc: '130123456',
 *   nombreComercial: 'Lácteos Cibao',
 *   actividadEconomica: 'Procesamiento de lácteos',
 *   municipalityId: 12,
 * };
 * ```
 */
export type CreateInstitutionRequest = Pick<
  Prisma.InstitutionCreateInput,
  | 'name'
  | 'streetName'
  | 'streetNum'
  | 'phoneNumber'
  | 'email'
  | 'rnc'
  | 'nombreComercial'
  | 'actividadEconomica'
> & {
  municipalityId: number;
};

/**
 * Body de `PATCH /institutions/:id`. Todos los campos son opcionales
 * (edición parcial de la información de la empresa).
 */
export type UpdateInstitutionRequest = Partial<CreateInstitutionRequest>;

/** Representante de una institución (Legal, Calidad o Contacto) con su `Person`. */
export type Represent = Prisma.RepresentGetPayload<{ include: { person: true } }>;

/**
 * Body de `POST /institutions/:id/representatives`.
 *
 * @example
 * ```ts
 * const body: CreateRepresentRequest = {
 *   person: { name: 'Juan Gómez', cedula: '001-9876543-2', phone: '8299876543', email: 'juan@empresa.com' },
 *   type: 'LEGAL',
 * };
 * ```
 */
export interface CreateRepresentRequest {
  person: Pick<Prisma.PersonCreateInput, 'name' | 'cedula' | 'phone' | 'email'>;
  type: 'LEGAL' | 'CALIDAD' | 'CONTACTO';
}

/**
 * Respuesta de `GET /institutions/:id/history` (RF-03: historial de casos,
 * evaluaciones y permisos sanitarios de la institución).
 */
export interface InstitutionHistoryResponse {
  cases: Case[];
  evaluations: EvaluationListItem[];
  saPermits: Prisma.SaPermitGetPayload<{}>[];
}
