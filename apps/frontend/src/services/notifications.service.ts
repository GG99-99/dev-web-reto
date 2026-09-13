/**
 * notifications.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Notificaciones (soporte a RF-04).
 * Ver API_CONTRACTS.md, sección 16.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationQuery,
  Notification,
} from '@reto/shared';

/** Filtros de `GET /notifications`, combinados con {@link PaginationQuery}. */
export interface ListNotificationsQuery extends PaginationQuery {
  read?: boolean;
}

/**
 * `GET /notifications` — Autenticado. Lista propias.
 *
 * @example
 * ```ts
 * const res = await notificationsService.list({ read: false });
 * ```
 */
async function list(
  query?: ListNotificationsQuery,
): Promise<ApiResponse<PaginatedResponse<Notification>>> {
  const { data } = await httpClient.get<ApiResponse<PaginatedResponse<Notification>>>(
    '/notifications',
    { params: query },
  );
  return data;
}

/** `PATCH /notifications/:id/read` — Autenticado. Marca una notificación como leída. */
async function markAsRead(id: number): Promise<ApiResponse<Notification>> {
  const { data } = await httpClient.patch<ApiResponse<Notification>>(
    `/notifications/${id}/read`,
  );
  return data;
}

/** `PATCH /notifications/read-all` — Autenticado. Marca todas las notificaciones como leídas. */
async function markAllAsRead(): Promise<ApiResponse<null>> {
  const { data } = await httpClient.patch<ApiResponse<null>>('/notifications/read-all');
  return data;
}

export const notificationsService = {
  list,
  markAsRead,
  markAllAsRead,
};
