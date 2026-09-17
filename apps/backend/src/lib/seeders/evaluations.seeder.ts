import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';

/**
 * evaluations.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `evaluation`. RF-07 / RF-11 / RF-12 (sección 7 del contrato).
 *
 * DEPENDE DE: cases.seeder.ts y users.seeder.ts.
 * Se cubren los 5 estados del enum `EvaluationStatus` para poder probar el
 * calendario del técnico, la reprogramación, la cancelación y la ejecución en
 * campo.
 *
 * `reason` se usa como CLAVE NATURAL (texto único por evaluación sembrada):
 * los seeders posteriores (form-responses, scores, evidences, reports) buscan
 * la evaluación por ese texto.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

export const EVAL_REASONS = {
  LACTEOS_INICIAL: 'Inspección inicial BPM — Lácteos del Norte',
  PANADERIA_INICIAL: 'Inspección inicial BPM — Panadería El Sol',
  DISTRIBUIDORA_RUTINA: 'Inspección de rutina — Distribuidora Caribe',
  LACTEOS_ALERTA: 'Inspección por alerta LAPCH — Lácteos del Norte',
  PANADERIA_DENUNCIA: 'Inspección por denuncia — Panadería El Sol',
} as const;

const EVALUATIONS: {
  reason: string;
  /** El caso se identifica por (rnc, origin). */
  rnc: string;
  origin: 'SOLICITUD_EMPRESA' | 'PROGRAMACION_INSTITUCIONAL' | 'ALERTA_LAPCH' | 'DENUNCIA';
  technicianCedula: string;
  scheduledDays: number;
  priority: 'BAJA' | 'MEDIA' | 'ALTA';
  status: 'PROGRAMADA' | 'REPROGRAMADA' | 'CANCELADA' | 'EN_PROCESO' | 'FINALIZADA';
  observations?: string;
  startedDays?: number;
  finishedDays?: number;
}[] = [
  {
    reason: EVAL_REASONS.PANADERIA_INICIAL,
    rnc: '130987654',
    origin: 'SOLICITUD_EMPRESA',
    technicianCedula: '001-0000004-4',
    scheduledDays: -28,
    priority: 'MEDIA',
    status: 'FINALIZADA',
    observations: 'Inspección completa ejecutada sin incidentes.',
    startedDays: -28,
    finishedDays: -28,
  },
  {
    reason: EVAL_REASONS.DISTRIBUIDORA_RUTINA,
    rnc: '130555777',
    origin: 'PROGRAMACION_INSTITUCIONAL',
    technicianCedula: '001-0000004-4',
    scheduledDays: -1,
    priority: 'BAJA',
    status: 'EN_PROCESO',
    observations: 'Inspección en curso, pendiente de finalizar en campo.',
    startedDays: -1,
  },
  {
    reason: EVAL_REASONS.LACTEOS_INICIAL,
    rnc: '130123456',
    origin: 'SOLICITUD_EMPRESA',
    technicianCedula: '001-0000003-3',
    scheduledDays: 3,
    priority: 'ALTA',
    status: 'PROGRAMADA',
    observations: 'Coordinar acceso con el representante de calidad.',
  },
  {
    reason: EVAL_REASONS.LACTEOS_ALERTA,
    rnc: '130123456',
    origin: 'ALERTA_LAPCH',
    technicianCedula: '001-0000003-3',
    scheduledDays: 6,
    priority: 'ALTA',
    status: 'REPROGRAMADA',
    observations: 'Reprogramada a solicitud de la empresa (planta en mantenimiento).',
  },
  {
    reason: EVAL_REASONS.PANADERIA_DENUNCIA,
    rnc: '130987654',
    origin: 'DENUNCIA',
    technicianCedula: '001-0000003-3',
    scheduledDays: -5,
    priority: 'MEDIA',
    status: 'CANCELADA',
    observations: 'Cancelada: la denuncia fue remitida a otro proceso.',
  },
];

// ========================== HELPERS ===============================

async function resolveCase(rnc: string, origin: string) {
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
  return { caseId: found.caseId, institutionId: institution.institutionId };
}

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

export async function seedEvaluations() {
  let created = 0;
  let skipped = 0;

  for (const item of EVALUATIONS) {
    const existing = await prisma.evaluation.findFirst({ where: { reason: item.reason } });
    if (existing) {
      skipped++;
      continue;
    }

    const { caseId, institutionId } = await resolveCase(item.rnc, item.origin);

    await prisma.evaluation.create({
      data: {
        caseId,
        institutionId,
        technicianId: await userIdByCedula(item.technicianCedula),
        scheduledDate: daysFromNow(item.scheduledDays),
        reason: item.reason,
        priority: item.priority,
        observations: item.observations,
        status: item.status,
        startedAt: item.startedDays !== undefined ? daysFromNow(item.startedDays) : null,
        finishedAt: item.finishedDays !== undefined ? daysFromNow(item.finishedDays) : null,
      },
    });
    created++;
  }

  logSeed('evaluations', created, skipped);
}
