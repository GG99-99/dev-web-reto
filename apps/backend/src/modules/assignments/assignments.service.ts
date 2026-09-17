import type { AssignTechnicianRequest } from '@reto/shared';
import { assignmentsModel } from './assignments.model';
import { casesService } from '../cases/cases.service';
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
    return assignmentsModel.create(caseId, data.technicianId, assignedById, data.notes, false);
  },

  reassign: async (caseId: number, assignedById: number, data: AssignTechnicianRequest) => {
    await casesService.getById(caseId); // 404 si no existe (no exige asignación previa)
    return assignmentsModel.create(caseId, data.technicianId, assignedById, data.notes, true);
  },
};
