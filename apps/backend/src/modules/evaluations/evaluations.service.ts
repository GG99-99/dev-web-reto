import type { Prisma } from '@reto/db';
import type { CalendarQuery, CreateEvaluationRequest, RescheduleEvaluationRequest } from '@reto/shared';
import { evaluationsModel, type EvaluationsFilter } from './evaluations.model';
import { casesService } from '../cases/cases.service';
import { institutionsService } from '../institutions/institutions.service';
import { dashboardModel } from '../dashboard/dashboard.model';
import { reopenStaleCorrection } from '../reports/correction-policy';
import { notificationsService } from '../notifications/notifications.service';
import { notifyInstitution } from '../lifecycle/request-lifecycle';
import { priorityLabel, priorityTone, renderOperationalEmail } from '@/lib/mail/email-layout';
import { ApiError } from '@/lib/common/ApiError';
import { normalizePagination, paginate, type NormalizedPagination } from '@/lib/common/response';

/**
 * evaluations.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio de RF-07 (programación) y RF-11 (calendario). Sección 7
 * de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */

type VisitNotice = {
  evaluationId: number;
  institutionId: number;
  technicianId: number;
  scheduledDate: Date;
  priority?: string | null;
  reason?: string | null;
  observations?: string | null;
  institution?: { name?: string | null } | null;
  case?: { caseId?: number | null } | null;
};

function formatVisitWhen(value: Date) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

/** Tells the assigned technician, and the company, that a visit changed. Mail failure must not undo the visit. */
async function notifyVisit(kind: 'scheduled' | 'rescheduled' | 'cancelled', evaluation: VisitNotice) {
  const place = evaluation.institution?.name?.trim() || 'the establishment';
  const when = formatVisitWhen(new Date(evaluation.scheduledDate));
  const caseLabel = evaluation.case?.caseId ? `#${evaluation.case.caseId}` : 'Not linked';
  const readablePriority = priorityLabel(evaluation.priority);
  const technicianCopy = {
    scheduled: {
      title: `New field visit: ${place}`,
      heading: 'A field visit was assigned to you',
      body: `A coordinator scheduled a sanitary evaluation at ${place} and assigned it to you.`,
    },
    rescheduled: {
      title: `Visit rescheduled: ${place}`,
      heading: 'A field visit was rescheduled',
      body: `The visit to ${place} has a new date. Confirm it in your calendar before you go.`,
    },
    cancelled: {
      title: `Visit cancelled: ${place}`,
      heading: 'A scheduled visit was cancelled',
      body: `The visit to ${place} was cancelled. You do not need to attend.`,
    },
  }[kind];
  const companyCopy = {
    scheduled: `A sanitary evaluation for ${place} is scheduled for ${when}. You can follow it in the company portal.`,
    rescheduled: `The sanitary evaluation for ${place} was moved to ${when}. The updated date is in the company portal.`,
    cancelled: `The sanitary evaluation scheduled for ${place} was cancelled. The request stays visible in the company portal.`,
  }[kind];

  try {
    await notificationsService.notify(
      evaluation.technicianId,
      technicianCopy.title,
      `${technicianCopy.body} When: ${when}. Case ${caseLabel}. Priority: ${readablePriority}.`,
      renderOperationalEmail({
        heading: technicianCopy.heading,
        paragraphs: [technicianCopy.body],
        details: [
          { label: 'Establishment', value: place },
          { label: 'When', value: when },
          { label: 'Evaluation', value: `#${evaluation.evaluationId}` },
          { label: 'Case', value: caseLabel },
          { label: 'Priority', value: readablePriority, tone: priorityTone(evaluation.priority) },
          ...(evaluation.reason?.trim() ? [{ label: 'Reason', value: evaluation.reason.trim() }] : []),
          ...(evaluation.observations?.trim() ? [{ label: 'Notes', value: evaluation.observations.trim() }] : []),
        ],
        footnote: 'Sign in to RADAR with your technician account to open the calendar and the field form.',
      }),
    );
    await notifyInstitution(
      evaluation.institutionId,
      kind === 'cancelled' ? `Evaluation cancelled: ${place}` : `Evaluation scheduled: ${place}`,
      companyCopy,
    );
  } catch (error) {
    console.error(`[mail] Visit notification failed for evaluation #${evaluation.evaluationId}:`, error);
  }
}

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
    const evaluation = await evaluationsModel.create({
      caseId: data.caseId,
      institutionId: caseDetail.institutionId,
      technicianId: caseDetail.technicianId,
      scheduledDate: new Date(data.scheduledDate),
      reason: data.reason,
      priority: data.priority,
      observations: data.observations,
    });
    await notifyVisit('scheduled', evaluation);
    return evaluation;
  },

  reschedule: async (evaluationId: number, data: RescheduleEvaluationRequest) => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (evaluation.status === 'CANCELADA' || evaluation.status === 'FINALIZADA' || evaluation.status === 'EN_CORRECCION') {
      throw ApiError.conflict('This evaluation can no longer be rescheduled');
    }
    const updated = await evaluationsModel.reschedule(evaluationId, new Date(data.scheduledDate), data.observations);
    await notifyVisit('rescheduled', updated);
    return updated;
  },

  cancel: async (evaluationId: number) => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (evaluation.status === 'FINALIZADA' || evaluation.status === 'EN_CORRECCION') {
      throw ApiError.conflict('A completed evaluation cannot be cancelled');
    }
    if (evaluation.status === 'CANCELADA') {
      throw ApiError.conflict('This evaluation is already cancelled');
    }
    const cancelled = await evaluationsModel.cancel(evaluationId);
    await notifyVisit('cancelled', cancelled);
    return cancelled;
  },

  getCalendar: async (technicianId: number, query: CalendarQuery) => {
    return evaluationsModel.getCalendar(technicianId, new Date(query.from), new Date(query.to));
  },
};
