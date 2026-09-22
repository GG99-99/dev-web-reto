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
    await notifyTechnicianAssigned(caseId, data.technicianId, false, data.notes);
    return assignment;
  },

  reassign: async (caseId: number, assignedById: number, data: AssignTechnicianRequest) => {
    await casesService.getById(caseId);
    const assignment = await assignmentsModel.create(caseId, data.technicianId, assignedById, data.notes, true);
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

  const message = `Case #${caseId} (${establishmentName}) ${actionText} to you. Priority: ${priority}.${notes ? ` Notes: ${notes}` : ''} Check the system details to schedule the sanitary evaluation.`;

  const priorityColor = priority === 'ALTA' ? '#dc2626' : priority === 'MEDIA' ? '#d97706' : '#16a34a';
  const priorityBg = priority === 'ALTA' ? '#fee2e2' : priority === 'MEDIA' ? '#fef3c7' : '#dcfce7';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1.5px solid #00236f; border-radius: 8px; overflow: hidden; background: #ffffff;">
      <div style="background: #00236f; color: #ffffff; padding: 18px 24px;">
        <h2 style="margin: 0; font-size: 18px; letter-spacing: 0.5px;">RADAR Sanitario • MISPAS / DIGEMAPS</h2>
        <p style="margin: 4px 0 0; color: #93c5fd; font-size: 12.5px;">Sanitary Surveillance and Risk-Based Evaluation System</p>
      </div>

      <div style="padding: 24px; color: #1e293b;">
        <h3 style="color: #00236f; margin-top: 0; font-size: 16px;">
          ${isReassignment ? '🔄 Case Reassigned to You' : '📋 New Case Assigned for Inspection'}
        </h3>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          Dear Evaluating Technician, the following case ${actionText} to you for technical inspection:
        </p>

        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin: 18px 0; font-size: 13.5px; line-height: 1.6;">
          <div><strong>Case:</strong> #${caseId}</div>
          <div><strong>Establishment:</strong> ${establishmentName}</div>
          <div style="margin-top: 4px;">
            <strong>Priority:</strong>
            <span style="background: ${priorityBg}; color: ${priorityColor}; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; text-transform: uppercase;">
              ${priority}
            </span>
          </div>
          ${notes ? `<div style="margin-top: 6px; color: #475569;"><strong>Instructions / Notes:</strong> ${notes}</div>` : ''}
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          Log into the operational panel to coordinate the field inspection, register the GMP form, and capture evidence.
        </p>
      </div>

      <div style="background: #f1f5f9; padding: 12px 24px; font-size: 11.5px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
        Dominican Republic • Ministry of Public Health and Social Assistance (MISPAS)
      </div>
    </div>
  `;

  await notificationsService.notify(technicianId, title, message, html);
}
