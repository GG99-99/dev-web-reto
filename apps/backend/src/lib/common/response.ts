import type { ApiSuccessResponse, PaginatedResponse, PaginationQuery } from '@reto/shared';

/**
 * response.ts
 * ---------------------------------------------------------------------------
 * Helpers para construir el envoltorio `ApiResponse<T>` (sección 0.1 de
 * API_CONTRACTS.md) desde los controllers. Los errores se manejan con
 * `ApiError` + `errorHandler`, nunca construyendo el `ApiErrorResponse` a mano.
 * ---------------------------------------------------------------------------
 */

export function ok<T>(data: T): ApiSuccessResponse<T> {
  return { valid: true, data };
}

export interface NormalizedPagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Normaliza `PaginationQuery` (ya validado por zod) a valores seguros para Prisma (skip/take). */
export function normalizePagination(query: PaginationQuery): NormalizedPagination {
  const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
  const pageSize = query.pageSize && query.pageSize > 0
    ? Math.min(Math.floor(query.pageSize), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    sortBy: query.sortBy,
    sortDir: query.sortDir ?? 'desc',
  };
}

export function paginate<T>(items: T[], total: number, pagination: NormalizedPagination): PaginatedResponse<T> {
  return {
    items,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
  };
}
