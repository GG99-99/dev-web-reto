import prisma, { type Person, type Prisma } from '@reto/db';

/**
 * person.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `Person`. Es la entidad base de usuarios, propietarios y
 * representantes (ver auth.ts, users.ts, institutions.ts en @reto/shared).
 * ---------------------------------------------------------------------------
 */
export const personModel = {
  getById: async (personId: number): Promise<Person | null> => {
    return prisma.person.findUnique({ where: { personId } });
  },

  getByEmail: async (email: string): Promise<Person | null> => {
    return prisma.person.findUnique({ where: { email } });
  },

  /** Usado por auth para validar credenciales: trae la Person + su User (password incluida). */
  getWithUserByEmail: async (email: string) => {
    return prisma.person.findUnique({
      where: { email },
      include: { user: { include: { role: true } } },
    });
  },

  getByCedula: async (cedula: string): Promise<Person | null> => {
    return prisma.person.findUnique({ where: { cedula } });
  },

  /** Usado por auth: `usuario` del LoginRequest puede ser email o cédula (sección 1 API_CONTRACTS.md). */
  getWithUserByCedula: async (cedula: string) => {
    return prisma.person.findUnique({
      where: { cedula },
      include: { user: { include: { role: true } } },
    });
  },

  create: async (data: Prisma.PersonCreateInput, tx: Prisma.TransactionClient = prisma): Promise<Person> => {
    return tx.person.create({ data });
  },

  update: async (personId: number, data: Prisma.PersonUpdateInput): Promise<Person> => {
    return prisma.person.update({ where: { personId }, data });
  },
};
