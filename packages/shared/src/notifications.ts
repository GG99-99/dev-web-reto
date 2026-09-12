/**
 * notifications.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Notificaciones (soporte a RF-04).
 * Endpoints: /notifications, /notifications/:id/read, /notifications/read-all
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';

/**
 * Modelo plano de `Notification`, generado por Prisma.
 *
 * @example
 * ```ts
 * // GET /notifications?read=false
 * const { data } = await api.get<PaginatedResponse<Notification>>('/notifications', { read: false });
 * ```
 */
export type Notification = Prisma.NotificationGetPayload<{}>;
