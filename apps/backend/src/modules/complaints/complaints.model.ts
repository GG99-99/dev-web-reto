import prisma, { type Prisma, type ComplaintResult } from '@reto/db';

/**
 * complaints.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `Complaint`. Sección 9 de API_CONTRACTS.md (RF-09).
 * ---------------------------------------------------------------------------
 */
export interface ComplaintsFilter {
  institutionId?: number;
  resultado?: ComplaintResult;
}

export const complaintsModel = {
  getMany: async (filter: ComplaintsFilter, skip: number, take: number) => {
    const where: Prisma.ComplaintWhereInput = {
      ...(filter.institutionId && { institutionId: filter.institutionId }),
      ...(filter.resultado && { resultado: filter.resultado }),
    };
    const [items, total] = await Promise.all([
      prisma.complaint.findMany({ where, skip, take, orderBy: { fechaRecepcion: 'desc' } }),
      prisma.complaint.count({ where }),
    ]);
    return { items, total };
  },

  getById: async (complaintId: number) => {
    return prisma.complaint.findUnique({ where: { complaintId }, include: { case: true } });
  },

  create: async (data: Prisma.ComplaintUncheckedCreateInput) => {
    return prisma.complaint.create({ data });
  },

  setResultado: async (complaintId: number, resultado: ComplaintResult) => {
    return prisma.complaint.update({ where: { complaintId }, data: { resultado } });
  },

  generateCase: async (complaintId: number, institutionId: number) => {
    return prisma.case.create({ data: { origin: 'DENUNCIA', institutionId, complaintId } });
  },
};
