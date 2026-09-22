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
    if (!alert) throw ApiError.notFound('LAPCH alert not found');
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
      throw ApiError.conflict('A case can only be generated when the result is PROCEDE');
    }
    if (alert.case) {
      throw ApiError.conflict('This alert already has a case generated');
    }
    const createdCase = await lapchAlertsModel.generateCase(alertId, alert.institutionId);
    return { case: createdCase };
  },

  /**
   * ⚠️ CONTRACT GAP: `LapchAlert` does not have a status column
   * "closed"/`closedAt` in the Prisma schema, so this endpoint does not
   * persist any new change: it only validates that the alert has a
   * `resultado` already defined (an unresolved alert cannot be "closed") and
   * returns the alert as is. TODO: add `LapchAlert.closedAt` in a
   * migration if it is necessary to distinguish "resolved" from "closed".
   */
  close: async (alertId: number) => {
    const alert = await lapchAlertsService.getById(alertId);
    if (!alert.resultado) {
      throw ApiError.validation('No se puede cerrar una alerta sin un resultado definido (PATCH .../resultado primero)');
    }
    return alert;
  },
};
