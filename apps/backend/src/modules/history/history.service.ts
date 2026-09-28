import type { HistorySearchQuery, HistorySearchResponse } from '@reto/shared';
import { historyModel, type HistoryFilter } from './history.model';
import { dashboardModel } from '../dashboard/dashboard.model';
import { ApiError } from '@/lib/common/ApiError';
import { normalizePagination, paginate } from '@/lib/common/response';

/**
 * history.service.ts
 * ---------------------------------------------------------------------------
 * RF-20. Sección 15 de API_CONTRACTS.md.
 *
 * NOTA DE RENDIMIENTO: cuando no se especifica `entityType`, se buscan las
 * 3 entidades (Case, Evaluation, BpmRequest) por separado y se combinan y
 * paginan EN MEMORIA (no a nivel de base de datos), porque son 3 tablas sin
 * un UNION nativo simple vía Prisma. Es correcto funcionalmente pero no
 * escala bien con volúmenes muy grandes de datos. TODO: si el historial
 * crece mucho, considerar una vista materializada o un UNION SQL crudo
 * (`prisma.$queryRaw`).
 * ---------------------------------------------------------------------------
 */

export const historyService = {
  search: async (
    query: HistorySearchQuery,
    requester: { personId: number; role: string | null },
  ): Promise<HistorySearchResponse> => {
    const filter: HistoryFilter = {
      institutionId: query.institutionId,
      bpmRequestId: query.bpmRequestId,
      evaluationId: query.evaluationId,
      status: query.status,
      fechaDesde: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
      fechaHasta: query.fechaHasta ? new Date(query.fechaHasta) : undefined,
    };

    // Company accounts only see history for establishments they own or represent.
    if (requester.role === 'ADMIN_EMPRESA' || requester.role === 'USUARIO_DELEGADO') {
      const ownedIds = requester.personId
        ? await dashboardModel.getOwnedInstitutionIds(requester.personId)
        : [];
      if (query.institutionId != null && !ownedIds.includes(query.institutionId)) {
        throw ApiError.forbidden('You do not have access to this establishment');
      }
      if (query.evaluationId != null) {
        const institutionId = await historyModel.evaluationInstitutionId(query.evaluationId);
        if (institutionId == null || !ownedIds.includes(institutionId)) {
          throw ApiError.forbidden('You do not have access to this evaluation');
        }
      }
      if (query.bpmRequestId != null) {
        const institutionId = await historyModel.bpmRequestInstitutionId(query.bpmRequestId);
        if (institutionId == null || !ownedIds.includes(institutionId)) {
          throw ApiError.forbidden('You do not have access to this request');
        }
      }
      filter.institutionIds = ownedIds;
    }

    const results =
      query.entityType === 'CASE'
        ? await historyModel.searchCases(filter)
        : query.entityType === 'EVALUATION'
          ? await historyModel.searchEvaluations(filter)
          : query.entityType === 'BPM_REQUEST'
            ? await historyModel.searchBpmRequests(filter)
            : (await Promise.all([historyModel.searchCases(filter), historyModel.searchEvaluations(filter), historyModel.searchBpmRequests(filter)])).flat();

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const pagination = normalizePagination(query);
    const page = results.slice(pagination.skip, pagination.skip + pagination.take);
    return paginate(page, results.length, pagination);
  },
};
