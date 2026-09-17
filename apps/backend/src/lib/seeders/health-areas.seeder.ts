import prisma from '@reto/db';
import { logSeed } from './seed.utils';

/**
 * health-areas.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `health_area`. Catálogo de apoyo a RF-03
 * (GET /catalogs/health-areas).
 *
 * Áreas de Salud I a VIII, tal como aparecen en la Ficha de Inspección BPM.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const HEALTH_AREAS = [
  'Área de Salud I',
  'Área de Salud II',
  'Área de Salud III',
  'Área de Salud IV',
  'Área de Salud V',
  'Área de Salud VI',
  'Área de Salud VII',
  'Área de Salud VIII',
];

// ============================ SEEDING =============================

export async function seedHealthAreas() {
  let created = 0;
  let skipped = 0;

  for (const name of HEALTH_AREAS) {
    const existing = await prisma.healthArea.findUnique({ where: { name } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.healthArea.create({ data: { name } });
    created++;
  }

  logSeed('health-areas', created, skipped);
}
