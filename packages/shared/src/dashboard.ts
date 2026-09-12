/**
 * dashboard.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Dashboard (RF-04).
 * Endpoints: /dashboard/empresa, /dashboard/coordinador, /dashboard/tecnico
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';
import type { BpmRequestListItem } from './bpmRequests';
import type { EvaluationListItem } from './evaluations';
import type { LapchAlert } from './lapchAlerts';
import type { Complaint } from './complaints';
import type { Case } from './cases';
import type { Evaluation } from './evaluations';

/**
 * Respuesta de `GET /dashboard/empresa` (ADMIN_EMPRESA / USUARIO_DELEGADO).
 * Widgets con las últimas N solicitudes/evaluaciones y notificaciones sin leer.
 *
 * @example
 * ```ts
 * const { data } = await api.get<DashboardEmpresaResponse>('/dashboard/empresa');
 * console.log(`Tienes ${data.notificacionesNoLeidas} notificaciones nuevas`);
 * ```
 */
export interface DashboardEmpresaResponse {
  /** Últimas N solicitudes BPM de la empresa. */
  misSolicitudes: BpmRequestListItem[];
  /** Evaluaciones asociadas a la empresa. */
  evaluaciones: EvaluationListItem[];
  /** Contador de notificaciones sin leer del usuario. */
  notificacionesNoLeidas: number;
}

/** Respuesta de `GET /dashboard/coordinador`. */
export interface DashboardCoordinadorResponse {
  /** Cantidad de casos aún sin asignar/atender. */
  casosPendientes: number;
  evaluacionesProgramadas: EvaluationListItem[];
  /** Alertas LAPCH abiertas (sin `resultado` definido o sin cerrar). */
  alertasLapchAbiertas: LapchAlert[];
  denunciasAbiertas: Complaint[];
  /** Casos que aún no tienen un `Assignment` de evaluador. */
  asignacionesPendientes: Case[];
}

/** Respuesta de `GET /dashboard/tecnico`. */
export interface DashboardTecnicoResponse {
  evaluacionesAsignadas: EvaluationListItem[];
  /** Vista resumida para pintar el calendario del técnico. */
  calendario: Pick<Evaluation, 'evaluationId' | 'scheduledDate' | 'status'>[];
  /** Evaluaciones finalizadas en campo que aún no tienen informe generado/enviado. */
  pendientesDeInforme: EvaluationListItem[];
}
