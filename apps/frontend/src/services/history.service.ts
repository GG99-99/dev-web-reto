/**
 * history.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Consulta Histórica (RF-20).
 * Endpoint de búsqueda transversal (agregador de lectura, no es un recurso propio).
 * Ver API_CONTRACTS.md, sección 15.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type { ApiResponse, HistorySearchQuery, HistorySearchResponse } from '@reto/shared';

/**
 * `GET /history/search` — COORDINADOR, ADMIN, ADMIN_EMPRESA (limitado a su empresa).
 *
 * @example
 * ```ts
 * const res = await historyService.search({
 *   institutionId: 7,
 *   entityType: 'EVALUATION',
 *   fechaDesde: '2026-01-01',
 *   fechaHasta: '2026-09-01',
 *   page: 1,
 *   pageSize: 20,
 * });
 * ```
 */
async function search(query: HistorySearchQuery): Promise<ApiResponse<HistorySearchResponse>> {
  const { data } = await httpClient.get<ApiResponse<HistorySearchResponse>>('/history/search', {
    params: query,
  });
  return data;
}

export const historyService = {
  search,
};
