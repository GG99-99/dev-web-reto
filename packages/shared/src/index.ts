/**
 * index.ts
 * ---------------------------------------------------------------------------
 * Punto de entrada único de los contratos de API del sistema PWA de
 * Evaluación Basada en Riesgo (EBR/BPM).
 *
 * Re-exporta todos los tipos/interfaces de cada módulo para que el resto
 * de la aplicación (frontend, cliente HTTP, validadores zod, etc.) pueda
 * importarlos desde un solo lugar:
 *
 * @example
 * ```ts
 * import type {
 *   ApiResponse,
 *   PaginatedResponse,
 *   LoginRequest,
 *   LoginResponse,
 *   CaseDetail,
 *   CreateEvaluationRequest,
 * } from '@/api/contracts';
 * ```
 *
 * También se puede importar un módulo puntual si se prefiere evitar el
 * barrel file en proyectos grandes (mejor tree-shaking / build incremental):
 *
 * @example
 * ```ts
 * import type { LoginRequest, LoginResponse } from '@/api/contracts/auth';
 * ```
 *
 * Mapeo módulo → sección de API_CONTRACTS.md:
 *  - common.ts        → 0. Convenciones generales
 *  - auth.ts          → 1. Auth (RF-01)
 *  - users.ts         → 2. Usuarios y Roles (RF-02 / RNF-02)
 *  - institutions.ts  → 3. Empresas / Instituciones (RF-03)
 *  - dashboard.ts     → 4. Dashboard (RF-04)
 *  - bpmRequests.ts   → 5. Solicitudes BPM (RF-05)
 *  - cases.ts         → 6. Casos / Expedientes (RF-06, RF-19)
 *  - evaluations.ts   → 7. Programación de Evaluaciones (RF-07) y Calendario (RF-11)
 *  - lapchAlerts.ts   → 8. Alertas LAPCH (RF-08)
 *  - complaints.ts    → 9. Denuncias (RF-09)
 *  - assignments.ts   → 10. Asignación de Evaluador (RF-10)
 *  - formExecution.ts → 11. Ejecución de Evaluación (RF-12) y Formulario EBR (RF-13)
 *  - riskEngine.ts    → 12. Motor de Riesgo (RF-14)
 *  - evidences.ts     → 13. Captura de Evidencias (RF-15)
 *  - reports.ts       → 14. Informe (RF-16), Revisión (RF-17), Correcciones (RF-18)
 *  - history.ts       → 15. Consulta Histórica (RF-20)
 *  - notifications.ts → 16. Notificaciones (soporte a RF-04)
 *  - catalogs.ts      → 17. Catálogos y Adjuntos genéricos
 *  - errors.ts        → 18. Mapa de errores estándar
 * ---------------------------------------------------------------------------
 */

export * from './common';
export * from './auth';
export * from './users';
export * from './institutions';
export * from './dashboard';
export * from './bpmRequests';
export * from './cases';
export * from './evaluations';
export * from './lapchAlerts';
export * from './complaints';
export * from './assignments';
export * from './formExecution';
export * from './riskEngine';
export * from './evidences';
export * from './reports';
export * from './history';
export * from './notifications';
export * from './catalogs';
export * from './errors';
