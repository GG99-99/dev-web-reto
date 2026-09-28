import prisma, { type Prisma } from '@reto/db';
import { syncBpmRequestForCase } from '../lifecycle/request-lifecycle';

/**
 * assignments.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `Assignment`. Sección 10 de API_CONTRACTS.md (RF-10).
 * ---------------------------------------------------------------------------
 */

const INCLUDE = { assignedTo: { include: { person: true } } } satisfies Prisma.AssignmentInclude;

export const assignmentsModel = {
  getManyByCase: async (caseId: number) => {
    return prisma.assignment.findMany({ where: { caseId }, include: INCLUDE, orderBy: { assignedAt: 'desc' } });
  },

  /** Crea el Assignment y actualiza Case.technicianId + status en una transacción. */
  create: async (caseId: number, technicianId: number, assignedById: number, notes: string | undefined, isReassignment: boolean) => {
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.create({
        data: { caseId, assignedToId: technicianId, assignedById, notes, isReassignment },
        include: INCLUDE,
      });

      const current = await tx.case.findUnique({ where: { caseId }, select: { status: true } });
      await tx.case.update({
        where: { caseId },
        data: {
          technicianId,
          status: current?.status === 'ABIERTO' ? 'ASIGNADO' : current?.status,
        },
      });

      await tx.evaluation.updateMany({
        where: {
          caseId,
          status: { in: ['PROGRAMADA', 'REPROGRAMADA', 'EN_PROCESO', 'EN_CORRECCION'] },
        },
        data: { technicianId },
      });
      await syncBpmRequestForCase(tx, caseId);

      return assignment;
    });
  },
};
