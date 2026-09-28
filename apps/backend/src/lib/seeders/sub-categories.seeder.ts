import prisma from '@reto/db';
import { logSeed, required } from './seed.utils';

/**
 * sub-categories.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `sub_category`. RF-14 / sección 17 del contrato
 * (GET /catalogs/categories/:id/subcategories).
 *
 * DEPENDE DE: categories.seeder.ts.
 * `risk` es el nivel de riesgo intrínseco del alimento (escala 1-3 usada
 * aquí: 1 bajo, 2 medio, 3 alto).
 *
 * ⚠️ Valores de `risk` asumidos para poder probar; reemplazar por los de
 * Matriz_Riesgo_Alimentos.xlsx cuando esté disponible.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const SUB_CATEGORIES: { category: string; name: string; risk: number }[] = [
  { category: 'Dairy and dairy products', name: 'Raw milk', risk: 3 },
  { category: 'Dairy and dairy products', name: 'Pasteurized milk', risk: 2 },
  { category: 'Dairy and dairy products', name: 'Fresh cheeses', risk: 3 },
  { category: 'Dairy and dairy products', name: 'Yogurt', risk: 2 },

  { category: 'Meat and sausages', name: 'Fresh beef', risk: 3 },
  { category: 'Meat and sausages', name: 'Fresh chicken', risk: 3 },
  { category: 'Meat and sausages', name: 'Cooked sausages', risk: 2 },

  { category: 'Bakery products', name: 'Unfilled bread', risk: 1 },
  { category: 'Bakery products', name: 'Cream-filled pastry', risk: 3 },

  { category: 'Non-alcoholic beverages', name: 'Pasteurized juices', risk: 2 },
  { category: 'Non-alcoholic beverages', name: 'Bottled water', risk: 2 },
  { category: 'Non-alcoholic beverages', name: 'Carbonated soft drinks', risk: 1 },

  { category: 'Fresh fruits and vegetables', name: 'Leafy vegetables', risk: 3 },
  { category: 'Fresh fruits and vegetables', name: 'Fruits with peel', risk: 1 },

  { category: 'Canned and preserved foods', name: 'Low-acid preserves', risk: 3 },
  { category: 'Canned and preserved foods', name: 'Acid preserves', risk: 1 },
];

// ============================ SEEDING =============================

export async function seedSubCategories() {
  let created = 0;
  let skipped = 0;

  for (const item of SUB_CATEGORIES) {
    const category = required(
      await prisma.category.findFirst({ where: { name: item.category } }),
      `categoría "${item.category}" (corre categories.seeder primero)`,
    );

    const existing = await prisma.subCategory.findFirst({
      where: { categoryId: category.categoryId, name: item.name },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.subCategory.create({
      data: { name: item.name, risk: item.risk, categoryId: category.categoryId },
    });
    created++;
  }

  logSeed('sub-categories', created, skipped);
}
