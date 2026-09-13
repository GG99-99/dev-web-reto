/**
 * assignments.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Asignación de Evaluador (RF-10).
 * Ver API_CONTRACTS.md, sección 10.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type { ApiResponse, Assignment, AssignTechnicianRequest } from '@reto/shared';

/** `GET /cases/:id/assignments` — COORDINADOR. Historial completo de asignaciones. */
async function listByCase(caseId: number): Promise<ApiResponse<Assignment[]>> {
  const { data } = await httpClient.get<ApiResponse<Assignment[]>>(`/cases/${caseId}/assignments`);
  return data;
}

/**
 * `POST /cases/:id/assign` — COORDINADOR. Asigna un evaluador al caso.
 *
 * @example
 * ```ts
 * await assignmentsService.assign(caseId, { technicianId: 4 });
 * ```
 */
async function assign(
  caseId: number,
  body: AssignTechnicianRequest,
): Promise<ApiResponse<Assignment>> {
  const { data } = await httpClient.post<ApiResponse<Assignment>>(`/cases/${caseId}/assign`, body);
  return data;
}

/**
 * `POST /cases/:id/reassign` — COORDINADOR.
 * Crea un nuevo `Assignment` con `isReassignment = true`, preservando el
 * historial de asignaciones previas.
 *
 * @example
 * ```ts
 * await assignmentsService.reassign(caseId, { technicianId: 5, notes: 'Reasignado por licencia médica' });
 * ```
 */
async function reassign(
  caseId: number,
  body: AssignTechnicianRequest,
): Promise<ApiResponse<Assignment>> {
  const { data } = await httpClient.post<ApiResponse<Assignment>>(
    `/cases/${caseId}/reassign`,
    body,
  );
  return data;
}

export const assignmentsService = {
  listByCase,
  assign,
  reassign,
};
