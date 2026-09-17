import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';

/**
 * bpm-requests.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `bpm_request`. RF-05 (sección 5 del contrato).
 *
 * DEPENDE DE: institutions.seeder.ts y users.seeder.ts.
 * Se siembran solicitudes en varios estados para poder probar las distintas
 * ramas del módulo:
 *   - BORRADOR              -> editable con PATCH, enviable con /submit
 *   - PENDIENTE_ASIGNACION  -> ya "enviada", su Case lo crea cases.seeder
 *   - EN_REVISION           -> flujo avanzado
 * Clave natural: el par (institutionId, motivo).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const BPM_REQUESTS: {
  rnc: string;
  createdByCedula: string;
  tipoEstablecimiento: string;
  motivo: string;
  observaciones?: string;
  status: 'BORRADOR' | 'PENDIENTE_ASIGNACION' | 'EN_REVISION';
  sentAtDays?: number;
}[] = [
  {
    rnc: '130123456',
    createdByCedula: '002-0000001-1',
    tipoEstablecimiento: 'Planta procesadora de lácteos',
    motivo: 'Solicitud inicial de certificación BPM',
    observaciones: 'Planta recién ampliada, se solicita inspección completa.',
    status: 'PENDIENTE_ASIGNACION',
    sentAtDays: -20,
  },
  {
    rnc: '130123456',
    createdByCedula: '002-0000002-2',
    tipoEstablecimiento: 'Planta procesadora de lácteos',
    motivo: 'Renovación de certificación BPM',
    observaciones: 'Renovación anual.',
    status: 'BORRADOR',
  },
  {
    rnc: '130987654',
    createdByCedula: '002-0000003-3',
    tipoEstablecimiento: 'Panadería y repostería',
    motivo: 'Solicitud inicial de certificación BPM',
    status: 'EN_REVISION',
    sentAtDays: -35,
  },
  {
    rnc: '130555777',
    createdByCedula: '002-0000001-1',
    tipoEstablecimiento: 'Almacén de distribución de alimentos',
    motivo: 'Ampliación de alcance del permiso sanitario',
    observaciones: 'Se agregó una cámara de refrigeración.',
    status: 'BORRADOR',
  },
];

// ============================ SEEDING =============================

export async function seedBpmRequests() {
  let created = 0;
  let skipped = 0;

  for (const item of BPM_REQUESTS) {
    const institution = required(
      await prisma.institution.findFirst({ where: { rnc: item.rnc } }),
      `institución con RNC ${item.rnc} (corre institutions.seeder primero)`,
    );

    const existing = await prisma.bpmRequest.findFirst({
      where: { institutionId: institution.institutionId, motivo: item.motivo },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const person = required(
      await prisma.person.findUnique({ where: { cedula: item.createdByCedula } }),
      `persona con cédula ${item.createdByCedula}`,
    );
    const user = required(
      await prisma.user.findUnique({ where: { personId: person.personId } }),
      `usuario de ${item.createdByCedula} (corre users.seeder primero)`,
    );

    await prisma.bpmRequest.create({
      data: {
        institutionId: institution.institutionId,
        createdById: user.userId,
        tipoEstablecimiento: item.tipoEstablecimiento,
        motivo: item.motivo,
        observaciones: item.observaciones,
        status: item.status,
        sentAt: item.sentAtDays !== undefined ? daysFromNow(item.sentAtDays) : null,
      },
    });
    created++;
  }

  logSeed('bpm-requests', created, skipped);
}
