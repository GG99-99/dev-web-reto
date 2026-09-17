import prisma from '@reto/db';
import { logSeed, required } from './seed.utils';

/**
 * foods.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `food`. Sección 17 del contrato (GET /catalogs/foods?categoryId=).
 *
 * DEPENDE DE: categories.seeder.ts.
 * `FormResponse.foodId` es obligatorio, así que sin alimentos no se puede
 * ejecutar POST /evaluations/:id/start.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const FOODS: { category: string; names: string[] }[] = [
  { category: 'Lácteos y derivados', names: ['Queso de freír', 'Leche entera UHT', 'Yogur de fresa'] },
  { category: 'Cárnicos y embutidos', names: ['Salami', 'Pechuga de pollo', 'Longaniza'] },
  { category: 'Productos de panadería', names: ['Pan de agua', 'Bizcocho de vainilla'] },
  { category: 'Bebidas no alcohólicas', names: ['Jugo de naranja', 'Agua purificada 5 galones'] },
  { category: 'Frutas y vegetales frescos', names: ['Lechuga', 'Plátano verde'] },
  { category: 'Alimentos enlatados y conservas', names: ['Habichuelas enlatadas', 'Salsa de tomate'] },
];

// ============================ SEEDING =============================

export async function seedFoods() {
  let created = 0;
  let skipped = 0;

  for (const group of FOODS) {
    const category = required(
      await prisma.category.findFirst({ where: { name: group.category } }),
      `categoría "${group.category}" (corre categories.seeder primero)`,
    );

    for (const name of group.names) {
      const existing = await prisma.food.findFirst({
        where: { categoryId: category.categoryId, name },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.food.create({ data: { name, categoryId: category.categoryId } });
      created++;
    }
  }

  logSeed('foods', created, skipped);
}
