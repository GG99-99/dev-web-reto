import type { ApiResponse, PaginatedResponse, PaginationQuery, Notification } from '@reto/shared';
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
declare function list(query?: ListNotificationsQuery): Promise<ApiResponse<PaginatedResponse<Notification>>>;
/** `PATCH /notifications/:id/read` — Autenticado. Marca una notificación como leída. */
declare function markAsRead(id: number): Promise<ApiResponse<Notification>>;
/** `PATCH /notifications/read-all` — Autenticado. Marca todas las notificaciones como leídas. */
declare function markAllAsRead(): Promise<ApiResponse<null>>;
export declare const notificationsService: {
    list: typeof list;
    markAsRead: typeof markAsRead;
    markAllAsRead: typeof markAllAsRead;
};
export {};
