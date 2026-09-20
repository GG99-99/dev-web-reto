import type { ApiResponse, Assignment, AssignTechnicianRequest } from '@reto/shared';
/** `GET /cases/:id/assignments` — COORDINADOR. Historial completo de asignaciones. */
declare function listByCase(caseId: number): Promise<ApiResponse<Assignment[]>>;
/**
 * `POST /cases/:id/assign` — COORDINADOR. Asigna un evaluador al caso.
 *
 * @example
 * ```ts
 * await assignmentsService.assign(caseId, { technicianId: 4 });
 * ```
 */
declare function assign(caseId: number, body: AssignTechnicianRequest): Promise<ApiResponse<Assignment>>;
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
declare function reassign(caseId: number, body: AssignTechnicianRequest): Promise<ApiResponse<Assignment>>;
export declare const assignmentsService: {
    listByCase: typeof listByCase;
    assign: typeof assign;
    reassign: typeof reassign;
};
export {};
