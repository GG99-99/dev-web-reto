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
  { category: 'Lácteos y derivados', name: 'Leche cruda', risk: 3 },
  { category: 'Lácteos y derivados', name: 'Leche pasteurizada', risk: 2 },
  { category: 'Lácteos y derivados', name: 'Quesos frescos', risk: 3 },
  { category: 'Lácteos y derivados', name: 'Yogur', risk: 2 },

  { category: 'Cárnicos y embutidos', name: 'Carne fresca de res', risk: 3 },
  { category: 'Cárnicos y embutidos', name: 'Pollo fresco', risk: 3 },
  { category: 'Cárnicos y embutidos', name: 'Embutidos cocidos', risk: 2 },

  { category: 'Productos de panadería', name: 'Pan sin relleno', risk: 1 },
  { category: 'Productos de panadería', name: 'Repostería con crema', risk: 3 },

  { category: 'Bebidas no alcohólicas', name: 'Jugos pasteurizados', risk: 2 },
  { category: 'Bebidas no alcohólicas', name: 'Agua embotellada', risk: 2 },
  { category: 'Bebidas no alcohólicas', name: 'Refrescos carbonatados', risk: 1 },

  { category: 'Frutas y vegetales frescos', name: 'Vegetales de hoja verde', risk: 3 },
  { category: 'Frutas y vegetales frescos', name: 'Frutas con cáscara', risk: 1 },

  { category: 'Alimentos enlatados y conservas', name: 'Conservas de baja acidez', risk: 3 },
  { category: 'Alimentos enlatados y conservas', name: 'Conservas ácidas', risk: 1 },
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
