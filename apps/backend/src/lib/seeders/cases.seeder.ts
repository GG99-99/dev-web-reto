import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';

/**
 * cases.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `case`. RF-06 / RF-19 (sección 6 del contrato).
 *
 * DEPENDE DE: institutions, users, bpm-requests, lapch-alerts y complaints.
 *
 * Un Case nace de 1 de 4 orígenes, y las FKs `bpmRequestId`/`lapchAlertId`/
 * `complaintId` son @unique (a lo sumo UNA poblada por fila, según `origin`).
 * Se siembra al menos un caso por origen y en distintos estados para poder
 * probar asignación (ABIERTO sin técnico), evaluación (ASIGNADO) y consulta
 * histórica (CERRADO).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const CASES: {
  /** Etiqueta solo para logs/legibilidad, no se persiste. */
  label: string;
  origin: 'SOLICITUD_EMPRESA' | 'PROGRAMACION_INSTITUCIONAL' | 'ALERTA_LAPCH' | 'DENUNCIA';
  rnc: string;
  priority: 'BAJA' | 'MEDIA' | 'ALTA';
  status: 'ABIERTO' | 'ASIGNADO' | 'EN_EVALUACION' | 'EN_REVISION' | 'CERRADO';
  coordinatorCedula?: string;
  technicianCedula?: string;
  /** motivo de la BpmRequest que origina el caso (origin = SOLICITUD_EMPRESA) */
  bpmRequestMotivo?: string;
  /** numeroAlerta de la LapchAlert que origina el caso (origin = ALERTA_LAPCH) */
  lapchNumeroAlerta?: string;
  /** denunciante de la Complaint que origina el caso (origin = DENUNCIA) */
  complaintDenunciante?: string;
  openedAtDays: number;
  closedAtDays?: number;
  resultadoFinal?: string;
}[] = [
  {
    label: 'Lácteos del Norte — solicitud inicial',
    origin: 'SOLICITUD_EMPRESA',
    rnc: '130123456',
    priority: 'ALTA',
    status: 'ASIGNADO',
    coordinatorCedula: '001-0000002-2',
    technicianCedula: '001-0000003-3',
    bpmRequestMotivo: 'Solicitud inicial de certificación BPM',
    openedAtDays: -20,
  },
  {
    label: 'Panadería El Sol — solicitud inicial',
    origin: 'SOLICITUD_EMPRESA',
    rnc: '130987654',
    priority: 'MEDIA',
    status: 'CERRADO',
    coordinatorCedula: '001-0000002-2',
    technicianCedula: '001-0000004-4',
    bpmRequestMotivo: 'Solicitud inicial de certificación BPM',
    openedAtDays: -35,
    closedAtDays: -2,
    resultadoFinal: 'Certificación BPM otorgada con observaciones menores subsanadas.',
  },
  {
    label: 'Lácteos del Norte — alerta LAPCH',
    origin: 'ALERTA_LAPCH',
    rnc: '130123456',
    priority: 'ALTA',
    status: 'ABIERTO',
    coordinatorCedula: '001-0000002-2',
    lapchNumeroAlerta: 'LAPCH-2026-001',
    openedAtDays: -14,
  },
  {
    label: 'Panadería El Sol — denuncia ciudadana',
    origin: 'DENUNCIA',
    rnc: '130987654',
    priority: 'MEDIA',
    status: 'ABIERTO',
    coordinatorCedula: '001-0000002-2',
    complaintDenunciante: 'Ciudadano anónimo',
    openedAtDays: -11,
  },
  {
    label: 'Distribuidora Caribe — programación institucional',
    origin: 'PROGRAMACION_INSTITUCIONAL',
    rnc: '130555777',
    priority: 'BAJA',
    status: 'EN_EVALUACION',
    coordinatorCedula: '001-0000002-2',
    technicianCedula: '001-0000004-4',
    openedAtDays: -7,
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

// ============================ SEEDING =============================

export async function seedCases() {
  let created = 0;
  let skipped = 0;

  for (const item of CASES) {
    const institution = required(
      await prisma.institution.findFirst({ where: { rnc: item.rnc } }),
      `institución con RNC ${item.rnc} (corre institutions.seeder primero)`,
    );

    // Resolver el origen (a lo sumo una FK poblada).
    let bpmRequestId: number | null = null;
    let lapchAlertId: number | null = null;
    let complaintId: number | null = null;

    if (item.bpmRequestMotivo) {
      const bpm = required(
        await prisma.bpmRequest.findFirst({
          where: { institutionId: institution.institutionId, motivo: item.bpmRequestMotivo },
        }),
        `solicitud BPM "${item.bpmRequestMotivo}" de ${item.rnc} (corre bpm-requests.seeder primero)`,
      );
      bpmRequestId = bpm.bpmRequestId;
    }
    if (item.lapchNumeroAlerta) {
      const alert = required(
        await prisma.lapchAlert.findFirst({ where: { numeroAlerta: item.lapchNumeroAlerta } }),
        `alerta ${item.lapchNumeroAlerta} (corre lapch-alerts.seeder primero)`,
      );
      lapchAlertId = alert.alertId;
    }
    if (item.complaintDenunciante) {
      const complaint = required(
        await prisma.complaint.findFirst({
          where: { institutionId: institution.institutionId, denunciante: item.complaintDenunciante },
        }),
        `denuncia de "${item.complaintDenunciante}" (corre complaints.seeder primero)`,
      );
      complaintId = complaint.complaintId;
    }

    // Clave natural: la FK de origen cuando existe; si no (programación
    // institucional), el par (institutionId, origin).
    const existing = await prisma.case.findFirst({
      where: bpmRequestId
        ? { bpmRequestId }
        : lapchAlertId
          ? { lapchAlertId }
          : complaintId
            ? { complaintId }
            : { institutionId: institution.institutionId, origin: item.origin },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.case.create({
      data: {
        origin: item.origin,
        institutionId: institution.institutionId,
        priority: item.priority,
        status: item.status,
        coordinatorId: item.coordinatorCedula ? await userIdByCedula(item.coordinatorCedula) : null,
        technicianId: item.technicianCedula ? await userIdByCedula(item.technicianCedula) : null,
        bpmRequestId,
        lapchAlertId,
        complaintId,
        openedAt: daysFromNow(item.openedAtDays),
        closedAt: item.closedAtDays !== undefined ? daysFromNow(item.closedAtDays) : null,
        resultadoFinal: item.resultadoFinal ?? null,
      },
    });
    created++;
  }

  logSeed('cases', created, skipped);
}
