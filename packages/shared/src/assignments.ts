/**
 * assignments.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Asignación de Evaluador (RF-10).
 * Endpoints: /cases/:id/assignments, /cases/:id/assign, /cases/:id/reassign
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';

/**
 * Asignación de un técnico evaluador a un caso, con la `Person` del técnico
 * incluida. Respuesta de `GET /cases/:id/assignments` (historial completo).
 */
export type Assignment = Prisma.AssignmentGetPayload<{
  include: { assignedTo: { include: { person: true } } };
}>;

/**
 * Body de `POST /cases/:id/assign` y `POST /cases/:id/reassign`.
 * En el caso de reasignación, el backend crea un nuevo `Assignment` con
 * `isReassignment = true`, preservando el historial de asignaciones previas.
 *
 * @example
 * ```ts
 * const body: AssignTechnicianRequest = { technicianId: 4, notes: 'Reasignado por licencia médica' };
 * await api.post(`/cases/${caseId}/reassign`, body);
 * ```
 */
export interface AssignTechnicianRequest {
  technicianId: number;
  notes?: string;
}
