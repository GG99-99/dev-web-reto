import type {
  DashboardEmpresaResponse,
  DashboardCoordinadorResponse,
  DashboardTecnicoResponse,
} from '@reto/shared';
import { dashboardModel } from './dashboard.model';

/**
 * dashboard.service.ts
 * ---------------------------------------------------------------------------
 * RF-04. Sección 4 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */
export const dashboardService = {
  getEmpresa: async (personId: number, userId: number): Promise<DashboardEmpresaResponse> => {
    const institutionIds = await dashboardModel.getOwnedInstitutionIds(personId);
    return dashboardModel.getEmpresaData(institutionIds, userId) as unknown as Promise<DashboardEmpresaResponse>;
  },

  getCoordinador: async (): Promise<DashboardCoordinadorResponse> => {
    return dashboardModel.getCoordinadorData() as unknown as Promise<DashboardCoordinadorResponse>;
  },

  getTecnico: async (technicianId: number): Promise<DashboardTecnicoResponse> => {
    return dashboardModel.getTecnicoData(technicianId) as unknown as Promise<DashboardTecnicoResponse>;
  },
};
