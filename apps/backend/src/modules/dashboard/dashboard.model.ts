import prisma, { type Prisma } from '@reto/db';

/**
 * dashboard.model.ts
 * ---------------------------------------------------------------------------
 * Consultas de solo lectura para los 3 dashboards de RF-04. Sección 4 de
 * API_CONTRACTS.md. No hay una tabla "Dashboard"; todo se compone a partir
 * de las tablas de los módulos ya construidos.
 * ---------------------------------------------------------------------------
 */

const EVALUATION_LIST_INCLUDE = {
  institution: { select: { institutionId: true, name: true, streetName: true } },
  technician: { include: { person: true } },
} satisfies Prisma.EvaluationInclude;

const BPM_LIST_INCLUDE = {
  institution: { select: { institutionId: true, name: true } },
} satisfies Prisma.BpmRequestInclude;

const RECENT_TAKE = 5;

export const dashboardModel = {
  /** Instituciones de las que `personId` es dueño o representante (para el dashboard de empresa). */
  getOwnedInstitutionIds: async (personId: number): Promise<number[]> => {
    const institutions = await prisma.institution.findMany({
      where: { OR: [{ propietary: { personId } }, { representantes: { some: { personId } } }] },
      select: { institutionId: true },
    });
    return institutions.map((i) => i.institutionId);
  },

  getEmpresaData: async (institutionIds: number[], userId: number) => {
    const [misSolicitudes, evaluaciones, notificacionesNoLeidas] = await Promise.all([
      prisma.bpmRequest.findMany({
        where: { institutionId: { in: institutionIds } },
        include: BPM_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: RECENT_TAKE,
      }),
      prisma.evaluation.findMany({
        where: { institutionId: { in: institutionIds } },
        include: EVALUATION_LIST_INCLUDE,
        orderBy: { scheduledDate: 'desc' },
        take: RECENT_TAKE,
      }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return { misSolicitudes, evaluaciones, notificacionesNoLeidas };
  },

  getCoordinadorData: async () => {
    const [casosPendientes, evaluacionesProgramadas, alertasLapchAbiertas, denunciasAbiertas, asignacionesPendientes] =
      await Promise.all([
        prisma.case.count({ where: { technicianId: null, status: { not: 'CERRADO' } } }),
        prisma.evaluation.findMany({
          where: { status: 'PROGRAMADA' },
          include: EVALUATION_LIST_INCLUDE,
          orderBy: { scheduledDate: 'asc' },
          take: RECENT_TAKE,
        }),
        prisma.lapchAlert.findMany({ where: { resultado: null }, orderBy: { fecha: 'desc' }, take: RECENT_TAKE }),
        prisma.complaint.findMany({ where: { resultado: null }, orderBy: { fechaRecepcion: 'desc' }, take: RECENT_TAKE }),
        prisma.case.findMany({ where: { technicianId: null }, orderBy: { openedAt: 'desc' }, take: RECENT_TAKE }),
      ]);
    return { casosPendientes, evaluacionesProgramadas, alertasLapchAbiertas, denunciasAbiertas, asignacionesPendientes };
  },

  getTecnicoData: async (technicianId: number) => {
    const [evaluacionesAsignadas, calendario, pendientesDeInforme] = await Promise.all([
      prisma.evaluation.findMany({
        where: { technicianId, status: { in: ['PROGRAMADA', 'REPROGRAMADA', 'EN_PROCESO'] } },
        include: EVALUATION_LIST_INCLUDE,
        orderBy: { scheduledDate: 'asc' },
      }),
      prisma.evaluation.findMany({
        where: { technicianId },
        select: { evaluationId: true, scheduledDate: true, status: true },
        orderBy: { scheduledDate: 'asc' },
      }),
      prisma.evaluation.findMany({
        where: { technicianId, status: 'FINALIZADA', report: null },
        include: EVALUATION_LIST_INCLUDE,
        orderBy: { finishedAt: 'desc' },
      }),
    ]);
    return { evaluacionesAsignadas, calendario, pendientesDeInforme };
  },
};
