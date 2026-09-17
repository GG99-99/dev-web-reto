import type { CreateLapchAlertRequest, GenerateCaseFromAlertResponse } from '@reto/shared';
import { lapchAlertsModel, type LapchAlertsFilter } from './lapch-alerts.model';
import { ApiError } from '@/lib/common/ApiError';
import { normalizePagination, paginate } from '@/lib/common/response';

/**
 * lapch-alerts.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio de RF-08. Sección 8 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */
export const lapchAlertsService = {
  getMany: async (filter: LapchAlertsFilter & { page?: number; pageSize?: number }) => {
    const pagination = normalizePagination(filter);
    const { items, total } = await lapchAlertsModel.getMany(filter, pagination.skip, pagination.take);
    return paginate(items, total, pagination);
  },

  getById: async (alertId: number) => {
    const alert = await lapchAlertsModel.getById(alertId);
    if (!alert) throw ApiError.notFound('La alerta LAPCH no existe');
    return alert;
  },

  create: async (data: CreateLapchAlertRequest) => {
    const { institutionId, ...rest } = data;
    return lapchAlertsModel.create({ ...rest, institutionId });
  },

  setResultado: async (alertId: number, resultado: 'PROCEDE' | 'NO_PROCEDE') => {
    await lapchAlertsService.getById(alertId);
    return lapchAlertsModel.setResultado(alertId, resultado);
  },

  generateCase: async (alertId: number): Promise<GenerateCaseFromAlertResponse> => {
    const alert = await lapchAlertsService.getById(alertId);
    if (alert.resultado !== 'PROCEDE') {
      throw ApiError.conflict('Solo se puede generar un caso cuando el resultado es PROCEDE');
    }
    if (alert.case) {
      throw ApiError.conflict('Esta alerta ya tiene un caso generado');
    }
    const createdCase = await lapchAlertsModel.generateCase(alertId, alert.institutionId);
    return { case: createdCase };
  },

  /**
   * ⚠️ GAP DE CONTRATO: `LapchAlert` no tiene una columna de estado
   * "cerrado"/`closedAt` en el schema de Prisma, así que este endpoint no
   * persiste ningún cambio nuevo: solo valida que la alerta tenga un
   * `resultado` ya definido (no puede "cerrarse" una alerta sin resolver) y
   * devuelve la alerta tal cual. TODO: agregar `LapchAlert.closedAt` en una
   * migración si se necesita distinguir "resuelta" de "cerrada".
   */
  close: async (alertId: number) => {
    const alert = await lapchAlertsService.getById(alertId);
    if (!alert.resultado) {
      throw ApiError.validation('No se puede cerrar una alerta sin un resultado definido (PATCH .../resultado primero)');
    }
    return alert;
  },
};
