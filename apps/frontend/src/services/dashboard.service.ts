/**
 * dashboard.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Dashboard (RF-04).
 * Ver API_CONTRACTS.md, sección 4.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  DashboardEmpresaResponse,
  DashboardCoordinadorResponse,
  DashboardTecnicoResponse,
} from '@reto/shared';

/**
 * `GET /dashboard/empresa` — ADMIN_EMPRESA, USUARIO_DELEGADO.
 *
 * @example
 * ```ts
 * const res = await dashboardService.getEmpresaDashboard();
 * if (res.valid) console.log(res.data.notificacionesNoLeidas);
 * ```
 */
async function getEmpresaDashboard(): Promise<ApiResponse<DashboardEmpresaResponse>> {
  const { data } = await httpClient.get<ApiResponse<DashboardEmpresaResponse>>('/dashboard/empresa');
  return data;
}

/** `GET /dashboard/coordinador` — COORDINADOR. */
async function getCoordinadorDashboard(): Promise<ApiResponse<DashboardCoordinadorResponse>> {
  const { data } = await httpClient.get<ApiResponse<DashboardCoordinadorResponse>>(
    '/dashboard/coordinador',
  );
  return data;
}

/** `GET /dashboard/tecnico` — TECNICO_EVALUADOR. */
async function getTecnicoDashboard(): Promise<ApiResponse<DashboardTecnicoResponse>> {
  const { data } = await httpClient.get<ApiResponse<DashboardTecnicoResponse>>('/dashboard/tecnico');
  return data;
}

export const dashboardService = {
  getEmpresaDashboard,
  getCoordinadorDashboard,
  getTecnicoDashboard,
};
