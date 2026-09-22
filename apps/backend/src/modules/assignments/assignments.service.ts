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
      throw ApiError.conflict('El caso ya tiene un técnico asignado; usa /reassign');
    }
    const assignment = await assignmentsModel.create(caseId, data.technicianId, assignedById, data.notes, false);
    await notifyTechnicianAssigned(caseId, data.technicianId, false);
    return assignment;
  },

  reassign: async (caseId: number, assignedById: number, data: AssignTechnicianRequest) => {
    await casesService.getById(caseId); // 404 si no existe (no exige asignación previa)
    const assignment = await assignmentsModel.create(caseId, data.technicianId, assignedById, data.notes, true);
    await notifyTechnicianAssigned(caseId, data.technicianId, true);
    return assignment;
  },
};

/** Notifica (in-app + correo) al técnico que se le acaba de asignar/reasignar un caso. */
async function notifyTechnicianAssigned(caseId: number, technicianId: number, isReassignment: boolean) {
  const title = isReassignment ? 'Caso reasignado' : 'Nuevo caso asignado';
  const message = isReassignment
    ? `Se te ha reasignado el caso #${caseId}. Revisa los detalles en el sistema.`
    : `Se te ha asignado el caso #${caseId}. Revisa los detalles en el sistema.`;
  await notificationsService.notify(technicianId, title, message);
}
