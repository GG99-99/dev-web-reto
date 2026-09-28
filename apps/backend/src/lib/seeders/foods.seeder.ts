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
  { category: 'Dairy and dairy products', names: ['Frying cheese', 'Whole UHT milk', 'Strawberry yogurt'] },
  { category: 'Meat and sausages', names: ['Salami', 'Chicken breast', 'Pork sausage'] },
  { category: 'Bakery products', names: ['Water bread', 'Vanilla cake'] },
  { category: 'Non-alcoholic beverages', names: ['Orange juice', 'Purified water, 5 gallons'] },
  { category: 'Fresh fruits and vegetables', names: ['Lettuce', 'Green plantain'] },
  { category: 'Canned and preserved foods', names: ['Canned beans', 'Tomato sauce'] },
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
