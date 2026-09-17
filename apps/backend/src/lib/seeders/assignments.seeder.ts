import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';

/**
 * assignments.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `assignment`. RF-10 (sección 10 del contrato).
 *
 * DEPENDE DE: cases.seeder.ts y users.seeder.ts.
 * Es el HISTORIAL de asignaciones de un caso: un caso reasignado conserva la
 * fila original y agrega una nueva con `isReassignment = true` (eso es lo que
 * devuelve GET /cases/:id/assignments).
 * Clave natural: el trío (caseId, assignedToId, isReassignment).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const ASSIGNMENTS: {
  /** El caso se identifica por (rnc de la institución, origin). */
  rnc: string;
  origin: 'SOLICITUD_EMPRESA' | 'PROGRAMACION_INSTITUCIONAL' | 'ALERTA_LAPCH' | 'DENUNCIA';
  assignedToCedula: string;
  assignedByCedula: string;
  isReassignment: boolean;
  notes?: string;
  assignedAtDays: number;
}[] = [
  {
    rnc: '130123456',
    origin: 'SOLICITUD_EMPRESA',
    assignedToCedula: '001-0000003-3',
    assignedByCedula: '001-0000002-2',
    isReassignment: false,
    notes: 'Asignación inicial. Planta de alto riesgo, priorizar.',
    assignedAtDays: -19,
  },
  {
    rnc: '130987654',
    origin: 'SOLICITUD_EMPRESA',
    assignedToCedula: '001-0000003-3',
    assignedByCedula: '001-0000002-2',
    isReassignment: false,
    notes: 'Asignación inicial.',
    assignedAtDays: -34,
  },
  {
    // Reasignación: el caso terminó ejecutado por el segundo técnico.
    rnc: '130987654',
    origin: 'SOLICITUD_EMPRESA',
    assignedToCedula: '001-0000004-4',
    assignedByCedula: '001-0000002-2',
    isReassignment: true,
    notes: 'Reasignado por carga de trabajo del técnico anterior.',
    assignedAtDays: -30,
  },
  {
    rnc: '130555777',
    origin: 'PROGRAMACION_INSTITUCIONAL',
    assignedToCedula: '001-0000004-4',
    assignedByCedula: '001-0000002-2',
    isReassignment: false,
    notes: 'Inspección programada de rutina.',
    assignedAtDays: -6,
  },
];

// ========================== HELPERS ===============================

async function userIdByCedula(cedula: string): Promise<number> {
  const person = required(
    await prisma.person.findUnique({ where: { cedula } }),
    `persona con cédula ${cedula}`,
  );
  const user = required(
    await prisma.user.findUnique({ where: { personId: person.personId } }),
    `usuario de ${cedula} (corre users.seeder primero)`,
  );
  return user.userId;
}

async function caseIdBy(rnc: string, origin: string): Promise<number> {
  const institution = required(
    await prisma.institution.findFirst({ where: { rnc } }),
    `institución con RNC ${rnc}`,
  );
  const found = required(
    await prisma.case.findFirst({
      where: { institutionId: institution.institutionId, origin: origin as never },
    }),
    `caso ${origin} de ${rnc} (corre cases.seeder primero)`,
  );
  return found.caseId;
}

// ============================ SEEDING =============================

export async function seedAssignments() {
  let created = 0;
  let skipped = 0;

  for (const item of ASSIGNMENTS) {
    const caseId = await caseIdBy(item.rnc, item.origin);
    const assignedToId = await userIdByCedula(item.assignedToCedula);
    const assignedById = await userIdByCedula(item.assignedByCedula);

    const existing = await prisma.assignment.findFirst({
      where: { caseId, assignedToId, isReassignment: item.isReassignment },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.assignment.create({
      data: {
        caseId,
        assignedToId,
        assignedById,
        isReassignment: item.isReassignment,
        notes: item.notes,
        assignedAt: daysFromNow(item.assignedAtDays),
      },
    });
    created++;
  }

  logSeed('assignments', created, skipped);
}
