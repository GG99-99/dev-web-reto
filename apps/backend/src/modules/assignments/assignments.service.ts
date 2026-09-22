import type { AssignTechnicianRequest } from '@reto/shared';
import { assignmentsModel } from './assignments.model';
import { casesService } from '../cases/cases.service';
import { notificationsService } from '../notifications/notifications.service';
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
    if (existing.technicianId) {
      throw ApiError.conflict('This case already has an assigned technician; use /reassign');
    }
    const assignment = await assignmentsModel.create(caseId, data.technicianId, assignedById, data.notes, false);
    await notifyTechnicianAssigned(caseId, data.technicianId, false);
    return assignment;
  },

  reassign: async (caseId: number, assignedById: number, data: AssignTechnicianRequest) => {
    await casesService.getById(caseId);
    const assignment = await assignmentsModel.create(caseId, data.technicianId, assignedById, data.notes, true);
    await notifyTechnicianAssigned(caseId, data.technicianId, true);
    return assignment;
  },
};

/** Notifies the technician in-app when they are assigned/reassigned to a case. */
async function notifyTechnicianAssigned(caseId: number, technicianId: number, isReassignment: boolean) {
  const title = isReassignment ? 'Case reassigned' : 'New case assigned';
  const message = isReassignment
    ? `Case #${caseId} has been reassigned to you. Please review the details in the system.`
    : `Case #${caseId} has been assigned to you. Please review the details in the system.`;
  await notificationsService.notify(technicianId, title, message);
}
