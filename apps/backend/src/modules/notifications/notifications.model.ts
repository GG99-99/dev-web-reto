import prisma, { type Prisma } from '@reto/db';

/**
 * notifications.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `Notification`. Soporte a RF-04.
 * ---------------------------------------------------------------------------
 */
export const notificationsModel = {
  getMany: async (userId: number, read: boolean | undefined, skip: number, take: number) => {
    const where: Prisma.NotificationWhereInput = { userId, ...(read !== undefined && { read }) };
    const [items, total] = await Promise.all([
      prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
    ]);
    return { items, total };
  },

  getById: async (notificationId: number) => {
    return prisma.notification.findUnique({ where: { notificationId } });
  },

  markRead: async (notificationId: number) => {
    return prisma.notification.update({ where: { notificationId }, data: { read: true } });
  },

  markAllRead: async (userId: number) => {
    return prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  },

  /** Crea una notificación in-app. Soporte a RF-04. */
  create: async (userId: number, title: string, message: string) => {
    return prisma.notification.create({ data: { userId, title, message } });
  },

  /** Email del usuario (vía Person), usado para enviar el correo asociado a la notificación. */
  getUserEmail: async (userId: number): Promise<string | null> => {
    const user = await prisma.user.findUnique({ where: { userId }, include: { person: true } });
    return user?.person.email ?? null;
  },
};
