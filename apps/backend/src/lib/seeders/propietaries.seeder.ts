import prisma from '@reto/db';
import { logSeed, required } from './seed.utils';

/**
 * propietaries.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `propietary`. Dueño de una o varias instituciones (RF-03).
 *
 * DEPENDE DE: persons.seeder.ts.
 * `Institution.propietaryId` es FK obligatoria, así que esto va antes de
 * institutions.seeder.ts. Clave natural: `personId` (@unique).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

/** Cédulas de las personas que son dueñas de empresa. */
const PROPIETARY_CEDULAS = [
  '002-0000001-1', // Pedro Martínez  -> Lácteos del Norte
  '002-0000003-3', // Miguel Santana  -> Panadería El Sol
];

// ============================ SEEDING =============================

export async function seedPropietaries() {
  let created = 0;
  let skipped = 0;

  for (const cedula of PROPIETARY_CEDULAS) {
    const person = required(
      await prisma.person.findUnique({ where: { cedula } }),
      `persona con cédula ${cedula} (corre persons.seeder primero)`,
    );

    const existing = await prisma.propietary.findUnique({ where: { personId: person.personId } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.propietary.create({ data: { personId: person.personId } });
    created++;
  }

  logSeed('propietaries', created, skipped);
}
