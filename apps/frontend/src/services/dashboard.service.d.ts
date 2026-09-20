import type { ApiResponse, DashboardEmpresaResponse, DashboardCoordinadorResponse, DashboardTecnicoResponse } from '@reto/shared';
/**
 * `GET /dashboard/empresa` — ADMIN_EMPRESA, USUARIO_DELEGADO.
 *
 * @example
 * ```ts
 * const res = await dashboardService.getEmpresaDashboard();
 * if (res.valid) console.log(res.data.notificacionesNoLeidas);
 * ```
 */
declare function getEmpresaDashboard(): Promise<ApiResponse<DashboardEmpresaResponse>>;
/** `GET /dashboard/coordinador` — COORDINADOR. */
declare function getCoordinadorDashboard(): Promise<ApiResponse<DashboardCoordinadorResponse>>;
/** `GET /dashboard/tecnico` — TECNICO_EVALUADOR. */
declare function getTecnicoDashboard(): Promise<ApiResponse<DashboardTecnicoResponse>>;
export declare const dashboardService: {
    getEmpresaDashboard: typeof getEmpresaDashboard;
    getCoordinadorDashboard: typeof getCoordinadorDashboard;
    getTecnicoDashboard: typeof getTecnicoDashboard;
};
export {};
