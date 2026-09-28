import type { Prisma } from '@reto/db';
import type { CalendarQuery, CreateEvaluationRequest, RescheduleEvaluationRequest } from '@reto/shared';
import { evaluationsModel, type EvaluationsFilter } from './evaluations.model';
import { casesService } from '../cases/cases.service';
import { institutionsService } from '../institutions/institutions.service';
import { dashboardModel } from '../dashboard/dashboard.model';
import { reopenStaleCorrection } from '../reports/correction-policy';
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
    requester: { userId: number; role: string | null; personId?: number },
  ) => {
    // RF-07: TECNICO_EVALUADOR solo ve sus propias evaluaciones.
    const effectiveFilter: EvaluationsFilter & typeof filter =
      requester.role === 'TECNICO_EVALUADOR' ? { ...filter, technicianId: requester.userId } : { ...filter };

    if (requester.role === 'ADMIN_EMPRESA' || requester.role === 'USUARIO_DELEGADO') {
      const owned = requester.personId ? await dashboardModel.getOwnedInstitutionIds(requester.personId) : [];
      if (effectiveFilter.institutionId && !owned.includes(effectiveFilter.institutionId)) {
        effectiveFilter.institutionIds = [-1];
        delete effectiveFilter.institutionId;
      } else if (!effectiveFilter.institutionId) {
        effectiveFilter.institutionIds = owned.length > 0 ? owned : [-1];
      }
    }

    const pagination = normalizePagination(filter);
    const orderBy = buildOrderBy(pagination);
    const { items, total } = await evaluationsModel.getMany(effectiveFilter, pagination.skip, pagination.take, orderBy);
    return paginate(items, total, pagination);
  },

  getById: async (evaluationId: number) => {
    await reopenStaleCorrection(evaluationId);
    const evaluation = await evaluationsModel.getById(evaluationId);
    if (!evaluation) throw ApiError.notFound('Evaluation not found');
    return evaluation;
  },

  assertAccess: async (
    evaluation: { technicianId: number; institutionId: number },
    requester: { userId: number; role: string | null; personId?: number },
  ) => {
    if (requester.role === 'COORDINADOR' || requester.role === 'ADMIN') return;
    if (requester.role === 'TECNICO_EVALUADOR' && evaluation.technicianId === requester.userId) return;
    if ((requester.role === 'ADMIN_EMPRESA' || requester.role === 'USUARIO_DELEGADO') && requester.personId) {
      await institutionsService.assertAccess(requester.personId, requester.role, evaluation.institutionId);
      return;
    }
    throw ApiError.forbidden('You do not have access to this evaluation');
  },

  create: async (data: CreateEvaluationRequest) => {
    const caseDetail = await casesService.getById(data.caseId);
    if (!caseDetail.technicianId) {
      throw ApiError.conflict('Assign one evaluator to this case before scheduling a visit');
    }
    if (data.technicianId !== caseDetail.technicianId) {
      throw ApiError.conflict('Only the evaluator currently assigned to this case can be scheduled');
    }
    if (caseDetail.status === 'CERRADO') {
      throw ApiError.conflict('A closed case cannot be reopened by scheduling a new evaluation');
    }
    const openVisit = (caseDetail.evaluations ?? []).some((item) => item.status !== 'CANCELADA');
    if (openVisit) {
      throw ApiError.conflict('This case already has an evaluation. Cancel it before scheduling another visit.');
    }
    return evaluationsModel.create({
      caseId: data.caseId,
      institutionId: caseDetail.institutionId,
      technicianId: caseDetail.technicianId,
      scheduledDate: new Date(data.scheduledDate),
      reason: data.reason,
      priority: data.priority,
      observations: data.observations,
    });
  },

  reschedule: async (evaluationId: number, data: RescheduleEvaluationRequest) => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (evaluation.status === 'CANCELADA' || evaluation.status === 'FINALIZADA' || evaluation.status === 'EN_CORRECCION') {
      throw ApiError.conflict('This evaluation can no longer be rescheduled');
    }
    return evaluationsModel.reschedule(evaluationId, new Date(data.scheduledDate), data.observations);
  },

  cancel: async (evaluationId: number) => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (evaluation.status === 'FINALIZADA' || evaluation.status === 'EN_CORRECCION') {
      throw ApiError.conflict('A completed evaluation cannot be cancelled');
    }
    if (evaluation.status === 'CANCELADA') {
      throw ApiError.conflict('This evaluation is already cancelled');
    }
    return evaluationsModel.cancel(evaluationId);
  },

  getCalendar: async (technicianId: number, query: CalendarQuery) => {
    return evaluationsModel.getCalendar(technicianId, new Date(query.from), new Date(query.to));
  },
};
