import prisma from '@reto/db';
import { logSeed, required } from './seed.utils';

/**
 * represents.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `represent`. RF-03 — representantes Legal / Calidad / Contacto de
 * cada empresa (POST /institutions/:id/representatives).
 *
 * DEPENDE DE: persons.seeder.ts e institutions.seeder.ts.
 * `FormResponse.representId` es obligatorio, así que sin representantes no se
 * puede ejecutar POST /evaluations/:id/start.
 * Clave natural: el par (personId, institutionId).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const REPRESENTS: { cedula: string; rnc: string; type: 'LEGAL' | 'CALIDAD' | 'CONTACTO' }[] = [
  { cedula: '003-0000001-1', rnc: '130123456', type: 'LEGAL' },
  { cedula: '003-0000002-2', rnc: '130123456', type: 'CALIDAD' },
  { cedula: '003-0000003-3', rnc: '130123456', type: 'CONTACTO' },
  { cedula: '003-0000004-4', rnc: '130987654', type: 'LEGAL' },
  { cedula: '003-0000005-5', rnc: '130987654', type: 'CALIDAD' },
];

// ============================ SEEDING =============================

export async function seedRepresents() {
  let created = 0;
  let skipped = 0;

  for (const item of REPRESENTS) {
    const person = required(
      await prisma.person.findUnique({ where: { cedula: item.cedula } }),
      `persona con cédula ${item.cedula} (corre persons.seeder primero)`,
    );
    const institution = required(
      await prisma.institution.findFirst({ where: { rnc: item.rnc } }),
      `institución con RNC ${item.rnc} (corre institutions.seeder primero)`,
    );

    const existing = await prisma.represent.findFirst({
      where: { personId: person.personId, institutionId: institution.institutionId },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.represent.create({
      data: {
        personId: person.personId,
        institutionId: institution.institutionId,
        type: item.type,
      },
    });
    created++;
  }

  logSeed('represents', created, skipped);
}
