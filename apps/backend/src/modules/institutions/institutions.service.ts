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

const COMPANY_ROLES = new Set(['ADMIN_EMPRESA', 'USUARIO_DELEGADO']);

export const institutionsService = {
  /**
   * Company accounts only receive establishments they own or represent.
   * The owner id always comes from the authenticated user, never from the query.
   */
  getMany: async (
    filter: InstitutionsFilter & { page?: number; pageSize?: number; sortBy?: string; sortDir?: 'asc' | 'desc' },
    requester: { role: string | null; personId?: number },
  ) => {
    const scoped: InstitutionsFilter & typeof filter = { ...filter };
    delete scoped.personId;
    if (COMPANY_ROLES.has(requester.role ?? '')) {
      scoped.personId = requester.personId && requester.personId > 0 ? requester.personId : -1;
    }

    const pagination = normalizePagination(scoped);
    const orderBy = buildOrderBy(pagination);
    const { items, total } = await institutionsModel.getMany(scoped, pagination.skip, pagination.take, orderBy);
    return paginate(items, total, pagination);
  },

  getById: async (institutionId: number) => {
    const institution = await institutionsModel.getById(institutionId);
    if (!institution) throw ApiError.notFound('Institution not found');
    return institution;
  },

  assertAccess: async (personId: number, role: string | null, institutionId: number) => {
    if (role === 'ADMIN' || role === 'COORDINADOR') return;

    if (role === 'TECNICO_EVALUADOR') {
      const assigned = await institutionsModel.technicianAssigned(personId, institutionId);
      if (!assigned) throw ApiError.forbidden('You do not have access to this institution');
      return;
    }

    const institution = await institutionsService.getById(institutionId);
    const isPropietary = institution.propietary.personId === personId;
    const isRepresentative = institution.representantes.some((r) => r.personId === personId);

    if (!isPropietary && !isRepresentative) {
      throw ApiError.forbidden('You do not have access to this institution');
    }
  },

  create: async (personId: number, data: CreateInstitutionRequest) => {
    const municipality = await institutionsModel.municipalityExists(data.municipalityId);
    if (!municipality) throw ApiError.validation('The selected municipality does not exist.');

    const duplicate = await institutionsModel.findByRnc(data.rnc.trim());
    if (duplicate) throw ApiError.conflict('An establishment with this RNC is already registered.');

    const propietary = await institutionsModel.findOrCreatePropietary(personId);
    const { municipalityId, ...rest } = data;
    return institutionsModel.create(
      { ...rest, rnc: data.rnc.trim() },
      propietary.propietaryId,
      municipalityId,
    );
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
    if (!existing) throw ApiError.notFound('Representative not found');
    if (existing.institutionId) {
      await institutionsService.assertAccess(requester.personId, requester.role, existing.institutionId);
    }
    return institutionsModel.updateRepresentative(representId, data.person ?? {}, data.type);
  },

  removeRepresentative: async (representId: number, requester: { personId: number; role: string | null }) => {
    const existing = await institutionsModel.getRepresentativeById(representId);
    if (!existing) throw ApiError.notFound('Representative not found');
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
