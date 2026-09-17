import prisma, { type Prisma, type UserStatus } from '@reto/db';

/**
 * users.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `User` (con `Person`/`Role` incluidos). Sección 2 de
 * API_CONTRACTS.md (RF-02 / RNF-02).
 * ---------------------------------------------------------------------------
 */

export interface UsersFilter {
  status?: UserStatus;
  roleId?: number;
}

const USER_INCLUDE = { person: true, role: true } satisfies Prisma.UserInclude;

export const usersModel = {
  getMany: async (filter: UsersFilter, skip: number, take: number, orderBy: Prisma.UserOrderByWithRelationInput) => {
    const where: Prisma.UserWhereInput = {
      ...(filter.status && { status: filter.status }),
      ...(filter.roleId && { roleId: filter.roleId }),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, include: USER_INCLUDE, skip, take, orderBy, omit: { password: true } }),
      prisma.user.count({ where }),
    ]);

    return { items, total };
  },

  getById: async (userId: number) => {
    return prisma.user.findUnique({ where: { userId }, include: USER_INCLUDE, omit: { password: true } });
  },

  updateStatus: async (userId: number, status: UserStatus) => {
    return prisma.user.update({ where: { userId }, data: { status }, include: USER_INCLUDE, omit: { password: true } });
  },

  softDelete: async (userId: number) => {
    return prisma.user.update({ where: { userId }, data: { isActive: false }, include: USER_INCLUDE, omit: { password: true } });
  },

  /** Alta transaccional: crea `Person` + `User` (status PENDIENTE_VALIDACION). */
  register: async (
    personData: Prisma.PersonCreateInput,
    passwordHash: string,
    roleId: number,
    cartaAutorizacionFileId?: number,
  ) => {
    return prisma.$transaction(async (tx) => {
      const person = await tx.person.create({ data: personData });

      const user = await tx.user.create({
        data: {
          personId: person.personId,
          password: passwordHash,
          roleId,
          // status/isActive usan sus defaults del schema (PENDIENTE_VALIDACION / true)
        },
        include: USER_INCLUDE,
        omit: { password: true },
      });

      if (cartaAutorizacionFileId) {
        await tx.attachment.update({
          where: { attachmentId: cartaAutorizacionFileId },
          data: { userRegistrationId: user.userId },
        });
      }

      return user;
    });
  },

  createNotification: async (userId: number, title: string, message: string) => {
    return prisma.notification.create({ data: { userId, title, message } });
  },
};
