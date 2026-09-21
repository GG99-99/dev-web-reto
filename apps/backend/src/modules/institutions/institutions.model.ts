import prisma, { type Prisma } from '@reto/db';

/**
 * institutions.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `Institution`, `Represent` e historial relacionado
 * (Case, Evaluation, SaPermit). Sección 3 de API_CONTRACTS.md (RF-03).
 * ---------------------------------------------------------------------------
 */

export interface InstitutionsFilter {
  provinceId?: number;
  municipalityId?: number;
  rnc?: string;
  q?: string;
  personId?: number;
}

const DETAIL_INCLUDE = {
  municipality: { include: { province: true } },
  representantes: { include: { person: true } },
  propietary: { include: { person: true } },
} satisfies Prisma.InstitutionInclude;

export const institutionsModel = {
  getMany: async (
    filter: InstitutionsFilter,
    skip: number,
    take: number,
    orderBy: Prisma.InstitutionOrderByWithRelationInput,
  ) => {
    const andClauses: Prisma.InstitutionWhereInput[] = [];
    if (filter.municipalityId) andClauses.push({ municipalityId: filter.municipalityId });
    if (filter.provinceId) andClauses.push({ municipality: { provinceId: filter.provinceId } });
    if (filter.rnc) andClauses.push({ rnc: filter.rnc });
    if (filter.personId) {
      andClauses.push({
        OR: [
          { propietary: { personId: filter.personId } },
          { representantes: { some: { personId: filter.personId } } },
        ],
      });
    }
    if (filter.q) {
      andClauses.push({
        OR: [
          { name: { contains: filter.q, mode: 'insensitive' } },
          { nombreComercial: { contains: filter.q, mode: 'insensitive' } },
          { rnc: { contains: filter.q, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.InstitutionWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};

    const [items, total] = await Promise.all([
      prisma.institution.findMany({ where, skip, take, orderBy, include: DETAIL_INCLUDE }),
      prisma.institution.count({ where }),
    ]);

    return { items, total };
  },

  getById: async (institutionId: number) => {
    return prisma.institution.findUnique({ where: { institutionId }, include: DETAIL_INCLUDE });
  },

  create: async (data: Omit<Prisma.InstitutionCreateInput, 'propietary' | 'municipality'>, propietaryId: number, municipalityId: number) => {
    return prisma.institution.create({
      data: {
        ...data,
        propietary: { connect: { propietaryId } },
        municipality: { connect: { municipalityId } },
      },
    });
  },

  update: async (institutionId: number, data: Prisma.InstitutionUpdateInput) => {
    return prisma.institution.update({ where: { institutionId }, data });
  },

  /** Devuelve al `Propietary` de una Person, creándolo si aún no existe (alta de empresa). */
  findOrCreatePropietary: async (personId: number) => {
    const existing = await prisma.propietary.findUnique({ where: { personId } });
    if (existing) return existing;
    return prisma.propietary.create({ data: { personId } });
  },

  /*******************
  |   REPRESENTANTES  |
   *******************/
  addRepresentative: async (institutionId: number, personData: Prisma.PersonCreateInput, type: 'LEGAL' | 'CALIDAD' | 'CONTACTO') => {
    return prisma.$transaction(async (tx) => {
      const person = await tx.person.create({ data: personData });
      return tx.represent.create({
        data: { personId: person.personId, institutionId, type },
        include: { person: true },
      });
    });
  },

  getRepresentativeById: async (representId: number) => {
    return prisma.represent.findUnique({ where: { representId }, include: { person: true } });
  },

  updateRepresentative: async (representId: number, personData: Prisma.PersonUpdateInput, type?: 'LEGAL' | 'CALIDAD' | 'CONTACTO') => {
    const current = await prisma.represent.findUniqueOrThrow({ where: { representId } });

    return prisma.$transaction(async (tx) => {
      if (Object.keys(personData).length > 0) {
        await tx.person.update({ where: { personId: current.personId }, data: personData });
      }
      return tx.represent.update({
        where: { representId },
        data: { ...(type && { type }) },
        include: { person: true },
      });
    });
  },

  removeRepresentative: async (representId: number) => {
    return prisma.represent.delete({ where: { representId } });
  },

  /*************
  |   HISTORY   |
   *************/
  getCasesByInstitution: async (institutionId: number) => {
    return prisma.case.findMany({ where: { institutionId }, orderBy: { openedAt: 'desc' } });
  },

  getEvaluationsByInstitution: async (institutionId: number) => {
    return prisma.evaluation.findMany({
      where: { institutionId },
      include: {
        institution: { select: { institutionId: true, name: true, streetName: true } },
        technician: { include: { person: true } },
      },
      orderBy: { scheduledDate: 'desc' },
    });
  },

  getSaPermitsByInstitution: async (institutionId: number) => {
    return prisma.saPermit.findMany({ where: { institutionId } });
  },
};
