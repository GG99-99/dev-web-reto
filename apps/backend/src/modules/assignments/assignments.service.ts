import type { AssignTechnicianRequest } from '@reto/shared';
import { assignmentsModel } from './assignments.model';
import { casesService } from '../cases/cases.service';
import { notificationsService } from '../notifications/notifications.service';
import { priorityLabel, priorityTone, renderOperationalEmail } from '@/lib/mail/email-layout';
import { ApiError } from '@/lib/common/ApiError';

/**
 * assignments.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio de RF-10. Sección 10 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */
export const assignmentsService = {
  getMany: async (caseId: number) => {
    await casesService.getById(caseId); // 404 si el caso no existe
    return assignmentsModel.getManyByCase(caseId);
  },

  assign: async (caseId: number, assignedById: number, data: AssignTechnicianRequest) => {
    const existing = await casesService.getById(caseId);
    if (existing.status === 'CERRADO') {
      throw ApiError.conflict('A closed case cannot be assigned');
    }
    if (existing.technicianId) {
      throw ApiError.conflict('This case already has an assigned technician; use /reassign');
    }
    const assignment = await assignmentsModel.create(caseId, data.technicianId, assignedById, data.notes, false);
    await notifyTechnicianAssigned(caseId, data.technicianId, false, data.notes);
    return assignment;
  },

  reassign: async (caseId: number, assignedById: number, data: AssignTechnicianRequest) => {
    const existing = await casesService.getById(caseId);
    if (existing.status === 'CERRADO') {
      throw ApiError.conflict('A closed case cannot be reassigned');
    }
    if (existing.technicianId === data.technicianId) {
      throw ApiError.conflict('This case already has that evaluator. Choose a different person to replace them.');
    }
    const assignment = await assignmentsModel.create(caseId, data.technicianId, assignedById, data.notes, true);
    if (existing.technicianId && existing.technicianId !== data.technicianId) {
      const place = existing.institution?.name ?? 'the establishment';
      await notificationsService.notify(
        existing.technicianId,
        `Case #${caseId} reassigned`,
        `You are no longer the evaluator for case #${caseId} (${place}). Open visits were transferred to the new evaluator.`,
        renderOperationalEmail({
          heading: 'This case is no longer assigned to you',
          paragraphs: [
            `Case #${caseId} at ${place} was given to another evaluator. You do not need to continue that visit.`,
          ],
          details: [
            { label: 'Case', value: `#${caseId}` },
            { label: 'Establishment', value: place },
          ],
          footnote: 'Your other assigned visits are unchanged. Open RADAR if you need to confirm your calendar.',
        }),
      );
    }
    await notifyTechnicianAssigned(caseId, data.technicianId, true, data.notes);
    return assignment;
  },
};

/** Notifica (in-app + correo) al técnico que se le acaba de asignar/reasignar un caso. */
async function notifyTechnicianAssigned(caseId: number, technicianId: number, isReassignment: boolean, notes?: string) {
  const title = isReassignment ? `Reassigned case: #${caseId}` : `New assigned case: #${caseId}`;
  const actionText = isReassignment ? 'has been reassigned' : 'has been assigned';

  let establishmentName = 'Regulated Establishment';
  let priority = 'MEDIA';
  try {
    const c = await casesService.getById(caseId);
    if (c?.institution?.name) establishmentName = c.institution.name;
    if (c?.priority) priority = c.priority;
  } catch {
    // Fallback defaults
  }

  const readablePriority = priorityLabel(priority);
  const message = `Case #${caseId} (${establishmentName}) ${actionText} to you. Priority: ${readablePriority}.${notes ? ` Notes: ${notes}` : ''} Open RADAR to prepare the sanitary evaluation.`;

  const html = renderOperationalEmail({
    heading: isReassignment ? 'A case was reassigned to you' : 'A new case was assigned to you',
    paragraphs: [
      isReassignment
        ? 'You are now the evaluator for this sanitary case. Any open visit was transferred to you.'
        : 'A coordinator assigned this sanitary case to you for field evaluation.',
    ],
    details: [
      { label: 'Case', value: `#${caseId}` },
      { label: 'Establishment', value: establishmentName },
      { label: 'Priority', value: readablePriority, tone: priorityTone(priority) },
      ...(notes?.trim() ? [{ label: 'Coordinator notes', value: notes.trim() }] : []),
    ],
    footnote: 'Sign in to RADAR with your technician account to see the case, schedule the visit, and complete the field form.',
  });

  await notificationsService.notify(technicianId, title, message, html);
}
