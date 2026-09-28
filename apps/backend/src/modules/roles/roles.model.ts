import prisma from '@reto/db';

export const rolesModel = {
  getMany: async () => {
    return prisma.role.findMany({ orderBy: { roleId: 'asc' } });
  },

  getById: async (roleId: number) => {
    return prisma.role.findUnique({ where: { roleId } });
  },
};
