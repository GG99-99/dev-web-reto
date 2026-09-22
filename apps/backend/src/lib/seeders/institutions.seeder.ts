import prisma from '@reto/db';
import { logSeed, required } from './seed.utils';

/**
 * institutions.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `institution`. RF-03 (sección 3 del contrato).
 *
 * DEPENDE DE: propietaries.seeder.ts y municipalities.seeder.ts.
 * Clave natural usada: `rnc` (no está marcado @unique en el schema, pero el
 * contrato lo trata como duplicable-con-409, así que aquí se usa para no
 * re-sembrar).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const INSTITUTIONS = [
  {
    name: 'Lácteos del Norte SRL',
    nombreComercial: 'Lácteos del Norte',
    actividadEconomica: 'Procesamiento y envasado de productos lácteos',
    rnc: '130123456',
    streetName: 'Av. Estrella Sadhalá',
    streetNum: '45',
    phoneNumber: '809-555-1000',
    email: 'contacto@lacteosdelnorte.do',
    propietaryCedula: '002-0000001-1',
    municipality: 'Santiago de los Caballeros',
  },
  {
    name: 'Panadería El Sol EIRL',
    nombreComercial: 'Panadería El Sol',
    actividadEconomica: 'Elaboración de productos de panadería y repostería',
    rnc: '130987654',
    streetName: 'Calle Duarte',
    streetNum: '12',
    phoneNumber: '809-555-2000',
    email: 'contacto@panaderiaelsol.do',
    propietaryCedula: '002-0000003-3',
    municipality: 'Santo Domingo Este',
  },
  {
    name: 'Distribuidora Caribe SA',
    nombreComercial: 'Distribuidora Caribe',
    actividadEconomica: 'Almacenamiento y distribución de alimentos envasados',
    rnc: '130555777',
    streetName: 'Autopista Duarte Km 12',
    streetNum: '3',
    phoneNumber: '809-555-3000',
    email: 'info@distcaribe.do',
    propietaryCedula: '002-0000001-1', // mismo dueño que Lácteos del Norte
    municipality: 'Santo Domingo Norte',
  },
];

// ============================ SEEDING =============================

export async function seedInstitutions() {
  let created = 0;
  let skipped = 0;

  for (const item of INSTITUTIONS) {
    const existing = await prisma.institution.findFirst({ where: { rnc: item.rnc } });
    if (existing) {
      skipped++;
      continue;
    }

    const person = required(
      await prisma.person.findUnique({ where: { cedula: item.propietaryCedula } }),
      `persona con cédula ${item.propietaryCedula}`,
    );
    const propietary = required(
      await prisma.propietary.findUnique({ where: { personId: person.personId } }),
      `propietary de ${item.propietaryCedula} (corre propietaries.seeder primero)`,
    );
    const municipality = required(
      await prisma.municipality.findFirst({ where: { name: item.municipality } }),
      `municipio "${item.municipality}" (corre municipalities.seeder primero)`,
    );

    await prisma.institution.create({
      data: {
        name: item.name,
        nombreComercial: item.nombreComercial,
        actividadEconomica: item.actividadEconomica,
        rnc: item.rnc,
        streetName: item.streetName,
        streetNum: item.streetNum,
        phoneNumber: item.phoneNumber,
        email: item.email,
        propietaryId: propietary.propietaryId,
        municipalityId: municipality.municipalityId,
      },
    });
    created++;
  }

  logSeed('institutions', created, skipped);
}
