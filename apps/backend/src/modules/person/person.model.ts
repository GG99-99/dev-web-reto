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

  /**
   * Person + User for login and password recovery.
   * Exact match first, then a case-insensitive match so "Ana@Org.com" still
   * finds the account stored as "ana@org.com".
   */
  getWithUserByEmail: async (email: string) => {
    const normalized = email.trim();
    const include = { user: { include: { role: true } } } as const;
    const exact = await prisma.person.findUnique({
      where: { email: normalized },
      include,
    });
    if (exact || !normalized) return exact;
    return prisma.person.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      include,
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
