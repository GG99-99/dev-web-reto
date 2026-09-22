import prisma from '@reto/db';
import { logSeed } from './seed.utils';

/**
 * provinces.seeder.ts
 * ---------------------------------------------------------------------------
 * Table: `province`. Catalog supporting RF-03
 * (GET /catalogs/provinces).
 *
 * All 32 provinces of the Dominican Republic + the Distrito Nacional,
 * matching the official list from the Oficina Nacional de Estadística (ONE).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const PROVINCES = [
  'Distrito Nacional',
  'Azua',
  'Bahoruco',
  'Barahona',
  'Dajabón',
  'Duarte',
  'Elías Piña',
  'El Seibo',
  'Espaillat',
  'Hato Mayor',
  'Hermanas Mirabal',
  'Independencia',
  'La Altagracia',
  'La Romana',
  'La Vega',
  'María Trinidad Sánchez',
  'Monseñor Nouel',
  'Monte Cristi',
  'Monte Plata',
  'Pedernales',
  'Peravia',
  'Puerto Plata',
  'Samaná',
  'San Cristóbal',
  'San José de Ocoa',
  'San Juan',
  'San Pedro de Macorís',
  'Sánchez Ramírez',
  'Santiago',
  'Santiago Rodríguez',
  'Santo Domingo',
  'Valverde',
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
