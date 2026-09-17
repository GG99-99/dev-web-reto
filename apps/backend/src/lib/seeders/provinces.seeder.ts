import prisma from '@reto/db';
import { logSeed } from './seed.utils';

/**
 * provinces.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `province`. Catálogo de apoyo a RF-03
 * (GET /catalogs/provinces).
 *
 * Subconjunto representativo de las 32 provincias de República Dominicana +
 * el Distrito Nacional. Suficiente para probar el API; completar con el
 * listado oficial de la ONE si se necesita para producción.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const PROVINCES = [
  'Distrito Nacional',
  'Santo Domingo',
  'Santiago',
  'La Vega',
  'San Cristóbal',
  'Duarte',
  'Puerto Plata',
  'La Altagracia',
  'San Pedro de Macorís',
  'Espaillat',
];

// ============================ SEEDING =============================

export async function seedProvinces() {
  let created = 0;
  let skipped = 0;

  for (const name of PROVINCES) {
    const existing = await prisma.province.findUnique({ where: { name } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.province.create({ data: { name } });
    created++;
  }

  logSeed('provinces', created, skipped);
}
