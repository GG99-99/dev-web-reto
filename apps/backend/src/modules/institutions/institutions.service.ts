import type { Prisma } from '@reto/db';
import type {
  CreateInstitutionRequest,
  CreateRepresentRequest,
  InstitutionHistoryResponse,
  UpdateInstitutionRequest,
} from '@reto/shared';
import { institutionsModel, type InstitutionsFilter } from './institutions.model';
import { ApiError } from '@/lib/common/ApiError';
import { normalizePagination, paginate, type NormalizedPagination } from '@/lib/common/response';

/**
 * institutions.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio de RF-03. Sección 3 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */

function buildOrderBy(pagination: NormalizedPagination): Prisma.InstitutionOrderByWithRelationInput {
  const allowed = new Set(['institutionId', 'name', 'rnc']);
  if (pagination.sortBy && allowed.has(pagination.sortBy)) {
    return { [pagination.sortBy]: pagination.sortDir } as Prisma.InstitutionOrderByWithRelationInput;
  }
  return { name: 'asc' };
}

export const institutionsService = {
  getMany: async (filter: InstitutionsFilter & { page?: number; pageSize?: number; sortBy?: string; sortDir?: 'asc' | 'desc' }) => {
    const pagination = normalizePagination(filter);
    const orderBy = buildOrderBy(pagination);
    const { items, total } = await institutionsModel.getMany(filter, pagination.skip, pagination.take, orderBy);
    return paginate(items, total, pagination);
  },

  getById: async (institutionId: number) => {
    const institution = await institutionsModel.getById(institutionId);
    if (!institution) throw ApiError.notFound('La institución no existe');
    return institution;
  },

  /**
   * RF-03: dueños/delegados solo ven SU empresa; roles operativos
   * (ADMIN, COORDINADOR, TECNICO_EVALUADOR) tienen acceso general de lectura.
   */
  assertAccess: async (personId: number, role: string | null, institutionId: number) => {
    if (role === 'ADMIN' || role === 'COORDINADOR' || role === 'TECNICO_EVALUADOR') return;

    const institution = await institutionsService.getById(institutionId);
    const isPropietary = institution.propietary.personId === personId;
    const isRepresentative = institution.representantes.some((r) => r.personId === personId);

    if (!isPropietary && !isRepresentative) {
      throw ApiError.forbidden('No tienes acceso a esta institución');
    }
  },

  create: async (personId: number, data: CreateInstitutionRequest) => {
    const propietary = await institutionsModel.findOrCreatePropietary(personId);
    const { municipalityId, ...rest } = data;
    return institutionsModel.create(rest, propietary.propietaryId, municipalityId);
  },

  update: async (institutionId: number, data: UpdateInstitutionRequest) => {
    await institutionsService.getById(institutionId);
    const { municipalityId, ...rest } = data;
    return institutionsModel.update(institutionId, {
      ...rest,
      ...(municipalityId && { municipality: { connect: { municipalityId } } }),
    });
  },

  addRepresentative: async (institutionId: number, data: CreateRepresentRequest) => {
    await institutionsService.getById(institutionId);
    return institutionsModel.addRepresentative(institutionId, data.person as Prisma.PersonCreateInput, data.type);
  },

  updateRepresentative: async (
    representId: number,
    data: { person?: Prisma.PersonUpdateInput; type?: 'LEGAL' | 'CALIDAD' | 'CONTACTO' },
    requester: { personId: number; role: string | null },
  ) => {
    const existing = await institutionsModel.getRepresentativeById(representId);
    if (!existing) throw ApiError.notFound('El representante no existe');
    if (existing.institutionId) {
      await institutionsService.assertAccess(requester.personId, requester.role, existing.institutionId);
    }
    return institutionsModel.updateRepresentative(representId, data.person ?? {}, data.type);
  },

  removeRepresentative: async (representId: number, requester: { personId: number; role: string | null }) => {
    const existing = await institutionsModel.getRepresentativeById(representId);
    if (!existing) throw ApiError.notFound('El representante no existe');
    if (existing.institutionId) {
      await institutionsService.assertAccess(requester.personId, requester.role, existing.institutionId);
    }
    return institutionsModel.removeRepresentative(representId);
  },

  getHistory: async (institutionId: number): Promise<InstitutionHistoryResponse> => {
    await institutionsService.getById(institutionId);
    const [cases, evaluations, saPermits] = await Promise.all([
      institutionsModel.getCasesByInstitution(institutionId),
      institutionsModel.getEvaluationsByInstitution(institutionId),
      institutionsModel.getSaPermitsByInstitution(institutionId),
    ]);
    return { cases, evaluations, saPermits };
  },

  getEvaluations: async (institutionId: number) => {
    await institutionsService.getById(institutionId);
    return institutionsModel.getEvaluationsByInstitution(institutionId);
  },
};
