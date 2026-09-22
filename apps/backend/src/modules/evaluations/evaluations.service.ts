import type { Prisma } from '@reto/db';
import type { CalendarQuery, CreateEvaluationRequest, RescheduleEvaluationRequest } from '@reto/shared';
import { evaluationsModel, type EvaluationsFilter } from './evaluations.model';
import { casesService } from '../cases/cases.service';
import { ApiError } from '@/lib/common/ApiError';
import { normalizePagination, paginate, type NormalizedPagination } from '@/lib/common/response';

/**
 * evaluations.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio de RF-07 (programación) y RF-11 (calendario). Sección 7
 * de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */

function buildOrderBy(pagination: NormalizedPagination): Prisma.EvaluationOrderByWithRelationInput {
  const allowed = new Set(['evaluationId', 'scheduledDate', 'status', 'createdAt']);
  if (pagination.sortBy && allowed.has(pagination.sortBy)) {
    return { [pagination.sortBy]: pagination.sortDir } as Prisma.EvaluationOrderByWithRelationInput;
  }
  return { scheduledDate: 'asc' };
}

export const evaluationsService = {
  getMany: async (
    filter: EvaluationsFilter & { page?: number; pageSize?: number; sortBy?: string; sortDir?: 'asc' | 'desc' },
    requester: { userId: number; role: string | null },
  ) => {
    // RF-07: TECNICO_EVALUADOR solo ve sus propias evaluaciones.
    const effectiveFilter =
      requester.role === 'TECNICO_EVALUADOR' ? { ...filter, technicianId: requester.userId } : filter;

    const pagination = normalizePagination(filter);
    const orderBy = buildOrderBy(pagination);
    const { items, total } = await evaluationsModel.getMany(effectiveFilter, pagination.skip, pagination.take, orderBy);
    return paginate(items, total, pagination);
  },

  getById: async (evaluationId: number) => {
    const evaluation = await evaluationsModel.getById(evaluationId);
    if (!evaluation) throw ApiError.notFound('Evaluation not found');
    return evaluation;
  },

  assertAccess: (evaluation: { technicianId: number }, requester: { userId: number; role: string | null }) => {
    if (requester.role === 'COORDINADOR' || requester.role === 'ADMIN') return;
    if (requester.role === 'TECNICO_EVALUADOR' && evaluation.technicianId === requester.userId) return;
    throw ApiError.forbidden('You do not have access to this evaluation');
  },

  create: async (data: CreateEvaluationRequest) => {
    const caseDetail = await casesService.getById(data.caseId);
    return evaluationsModel.create({
      caseId: data.caseId,
      institutionId: caseDetail.institutionId,
      technicianId: data.technicianId,
      scheduledDate: new Date(data.scheduledDate),
      reason: data.reason,
      priority: data.priority,
      observations: data.observations,
    });
  },

  reschedule: async (evaluationId: number, data: RescheduleEvaluationRequest) => {
    await evaluationsService.getById(evaluationId);
    return evaluationsModel.reschedule(evaluationId, new Date(data.scheduledDate), data.observations);
  },

  cancel: async (evaluationId: number) => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (evaluation.status === 'FINALIZADA') {
      throw ApiError.conflict('A completed evaluation cannot be cancelled');
    }
    return evaluationsModel.cancel(evaluationId);
  },

  getCalendar: async (technicianId: number, query: CalendarQuery) => {
    return evaluationsModel.getCalendar(technicianId, new Date(query.from), new Date(query.to));
  },
};
