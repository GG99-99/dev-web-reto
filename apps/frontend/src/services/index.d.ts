/**
 * index.ts
 * ---------------------------------------------------------------------------
 * Punto de entrada único de los servicios axios tipados del sistema
 * PWA de Evaluación Basada en Riesgo (EBR/BPM). Todos los tipos usados en
 * estos servicios se importan desde `@reto/shared`.
 *
 * @example
 * ```ts
 * import { authService, casesService, setAccessTokenProvider } from '@/services';
 *
 * setAccessTokenProvider(() => authStore.getState().accessToken);
 *
 * const res = await casesService.list({ status: 'ABIERTO', page: 1 });
 * if (res.valid) console.log(res.data.items);
 * ```
 *
 * Mapeo archivo → sección de API_CONTRACTS.md:
 *  - httpClient.ts             → 0. Convenciones generales (cliente axios base)
 *  - auth.service.ts           → 1. Auth (RF-01)
 *  - users.service.ts          → 2. Usuarios y Roles (RF-02 / RNF-02)
 *  - institutions.service.ts   → 3. Empresas / Instituciones (RF-03)
 *  - dashboard.service.ts      → 4. Dashboard (RF-04)
 *  - bpmRequests.service.ts    → 5. Solicitudes BPM (RF-05)
 *  - cases.service.ts          → 6. Casos / Expedientes (RF-06, RF-19)
 *  - evaluations.service.ts    → 7. Programación de Evaluaciones (RF-07) y Calendario (RF-11)
 *  - lapchAlerts.service.ts    → 8. Alertas LAPCH (RF-08)
 *  - complaints.service.ts     → 9. Denuncias (RF-09)
 *  - assignments.service.ts    → 10. Asignación de Evaluador (RF-10)
 *  - formExecution.service.ts  → 11. Ejecución de Evaluación (RF-12) y Formulario EBR (RF-13)
 *  - riskEngine.service.ts     → 12. Motor de Riesgo (RF-14)
 *  - evidences.service.ts      → 13. Captura de Evidencias (RF-15)
 *  - reports.service.ts        → 14. Informe (RF-16), Revisión (RF-17), Correcciones (RF-18)
 *  - history.service.ts        → 15. Consulta Histórica (RF-20)
 *  - notifications.service.ts  → 16. Notificaciones (soporte a RF-04)
 *  - catalogs.service.ts       → 17. Catálogos y Adjuntos genéricos
 * ---------------------------------------------------------------------------
 */
export { httpClient, setAccessTokenProvider, setRefreshTokenProvider, setOnTokenRefreshed, setOnSessionExpired, } from './httpClient';
export { authService } from './auth.service';
export { usersService, type ListUsersQuery, type UpdateUserRequest } from './users.service';
export { institutionsService, type ListInstitutionsQuery, type Province, type Municipality, } from './institutions.service';
export { dashboardService } from './dashboard.service';
export { bpmRequestsService, type ListBpmRequestsQuery } from './bpmRequests.service';
export { casesService, type ListCasesQuery } from './cases.service';
export { evaluationsService, type ListEvaluationsQuery } from './evaluations.service';
export { lapchAlertsService, type ListLapchAlertsQuery } from './lapchAlerts.service';
export { complaintsService, type ListComplaintsQuery } from './complaints.service';
export { assignmentsService } from './assignments.service';
export { formExecutionService } from './formExecution.service';
export { riskEngineService } from './riskEngine.service';
export { evidencesService } from './evidences.service';
export { reportsService } from './reports.service';
export { historyService } from './history.service';
export { notificationsService, type ListNotificationsQuery } from './notifications.service';
export { catalogsService } from './catalogs.service';
