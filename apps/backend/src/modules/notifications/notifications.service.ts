import { notificationsModel } from './notifications.model';
import { mailService } from '@/lib/mail/mail.service';
import { ApiError } from '@/lib/common/ApiError';
import { normalizePagination, paginate } from '@/lib/common/response';

export const notificationsService = {
  getMany: async (userId: number, filter: { read?: boolean; page?: number; pageSize?: number }) => {
    const pagination = normalizePagination(filter);
    const { items, total } = await notificationsModel.getMany(userId, filter.read, pagination.skip, pagination.take);
    return paginate(items, total, pagination);
  },

  markRead: async (notificationId: number, userId: number) => {
    const notification = await notificationsModel.getById(notificationId);
    if (!notification) throw ApiError.notFound('Notification not found');
    if (notification.userId !== userId) throw ApiError.forbidden('You do not have access to this notification');
    return notificationsModel.markRead(notificationId);
  },

  markAllRead: async (userId: number) => {
    await notificationsModel.markAllRead(userId);
  },

  /**
   * Crea una notificación in-app para el usuario y, además, le envía un
   * correo con el mismo contenido. Es el punto único que el resto de
   * módulos (asignaciones, casos, alertas, etc.) debe usar para notificar a
   * un usuario, en vez de llamar a notificationsModel/mailService por su
   * cuenta.
   *
   * El envío de correo nunca lanza ni bloquea la creación de la
   * notificación in-app (ver mailService.sendMail).
   */
  notify: async (userId: number, title: string, message: string) => {
    const notification = await notificationsModel.create(userId, title, message);

    const email = await notificationsModel.getUserEmail(userId);
    if (email) {
      await mailService.sendMail({ to: email, subject: title, text: message });
    }

    return notification;
  },
};
