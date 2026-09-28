import prisma from '@reto/db';
import { logSeed } from './seed.utils';

/**
 * categories.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `category`. Catálogo de alimentos (sección 17 del contrato,
 * GET /catalogs/categories).
 *
 * ⚠️ Los nombres son un set de trabajo para poder probar el API; NO provienen
 * del documento oficial Matriz_Riesgo_Alimentos.xlsx (no está en el repo).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const CATEGORIES = [
  'Dairy and dairy products',
  'Meat and sausages',
  'Bakery products',
  'Non-alcoholic beverages',
  'Fresh fruits and vegetables',
  'Canned and preserved foods',
];

// ============================ SEEDING =============================

export async function seedCategories() {
  let created = 0;
  let skipped = 0;

  for (const name of CATEGORIES) {
    const existing = await prisma.category.findFirst({ where: { name } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.category.create({ data: { name } });
    created++;
  }

  logSeed('categories', created, skipped);
}
