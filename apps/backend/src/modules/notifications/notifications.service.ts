import { notificationsModel } from './notifications.model';
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
    if (!notification) throw ApiError.notFound('La notificación no existe');
    if (notification.userId !== userId) throw ApiError.forbidden('No tienes acceso a esta notificación');
    return notificationsModel.markRead(notificationId);
  },

  markAllRead: async (userId: number) => {
    await notificationsModel.markAllRead(userId);
  },
};
