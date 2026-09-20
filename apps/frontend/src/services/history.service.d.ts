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
declare function search(query: HistorySearchQuery): Promise<ApiResponse<HistorySearchResponse>>;
export declare const historyService: {
    search: typeof search;
};
export {};
