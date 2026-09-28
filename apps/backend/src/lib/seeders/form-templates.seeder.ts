import prisma from '@reto/db';
import { logSeed } from './seed.utils';

/**
 * form-templates.seeder.ts
 * ---------------------------------------------------------------------------
 * Tablas: `form_template`, `h1`, `h1_ask`, `h2`, `h2_ask`, `h3`, `h3_ask`,
 * `h4`, `h4_ask`. RF-13 (sección 11.1 del contrato:
 * GET /form-templates y GET /form-templates/:id/tree).
 *
 * Se siembra el ÁRBOL COMPLETO en un solo seeder (y no uno por nivel) porque
 * h1..h4 no tienen sentido por separado: cada nivel solo existe colgando de
 * su padre, y `formId`/`h1Id`/`h2Id`/`h3Id` son FKs obligatorias. Sembrarlos
 * en archivos distintos obligaría a re-resolver el padre por nombre en cada
 * uno, que es más frágil que recorrer el árbol una vez.
 *
 * ⚠️ Contenido de trabajo: es una versión REDUCIDA y de estructura
 * representativa de la Ficha de Inspección BPM (no es la ficha oficial
 * completa, que no está en el repo). Sirve para probar el flujo
 * start → answers → finish de punta a punta.
 *
 * `form_template.active = true` importa: form-execution.service.ts toma
 * automáticamente la plantilla activa más reciente.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

interface H4Seed { name: string; asks: string[] }
interface H3Seed { name: string; asks: string[]; h4s?: H4Seed[] }
interface H2Seed { name: string; asks: string[]; h3s?: H3Seed[] }
interface H1Seed { name: string; asks: string[]; h2s?: H2Seed[] }

const TEMPLATE_NAME = 'BPM Inspection Form v1.00';

const TREE: H1Seed[] = [
  {
    name: '1. ESTABLISHMENT',
    asks: ['The establishment has a current sanitary permit'],
    h2s: [
      {
        name: '1.1 Location and surroundings',
        asks: ['The surroundings are free of accumulated garbage'],
        h3s: [
          {
            name: '1.1.1 Establishment location',
            asks: [
              'It is away from sources of contamination',
              'Access roads are paved or treated against dust',
            ],
          },
          {
            name: '1.1.2 Physical structure',
            asks: ['The structure is made of durable material that is easy to clean'],
            h4s: [
              {
                name: '1.1.2.1 Walls',
                asks: [
                  'Walls are smooth, waterproof, and light-colored',
                  'Wall-to-floor joints are rounded (sanitary coving)',
                ],
              },
              {
                name: '1.1.2.2 Floors',
                asks: [
                  'Floors are waterproof and non-slip',
                  'Floors slope toward the drains',
                ],
              },
              {
                name: '1.1.2.3 Ceilings',
                asks: ['Ceilings prevent the buildup of dirt and condensation'],
              },
            ],
          },
        ],
      },
      {
        name: '1.2 Basic services',
        asks: ['There is a continuous supply of potable water'],
        h3s: [
          {
            name: '1.2.1 Water',
            asks: [
              'The water used meets potability parameters',
              'Water chlorination records are kept',
            ],
          },
          {
            name: '1.2.2 Waste handling',
            asks: [
              'Solid waste is stored in covered containers',
              'Final waste disposal is adequate',
            ],
          },
        ],
      },
    ],
  },
  {
    name: '2. FOOD HANDLERS',
    asks: ['Staff have a current health certificate'],
    h2s: [
      {
        name: '2.1 Personnel hygiene',
        asks: ['Staff wear a clean, complete uniform'],
        h3s: [
          {
            name: '2.1.1 Hygienic practices',
            asks: [
              'Staff wash their hands when entering the processing area',
              'Staff do not wear jewelry or makeup in the processing area',
              'Hygiene notices are posted in visible places',
            ],
          },
          {
            name: '2.1.2 Training',
            asks: ['There is a documented GMP training program'],
          },
        ],
      },
    ],
  },
  {
    name: '3. PROCESS AND PRODUCTION',
    asks: ['Production process documentation exists'],
    h2s: [
      {
        name: '3.1 Raw materials',
        asks: ['Raw materials are inspected on receipt'],
        h3s: [
          {
            name: '3.1.1 Storage',
            asks: [
              'Raw materials are stored on pallets away from the wall',
              'The FIFO principle (first in, first out) is applied',
            ],
          },
        ],
      },
      {
        name: '3.2 Temperature control',
        asks: ['Cold equipment has a visible thermometer'],
        h3s: [
          {
            name: '3.2.1 Cold chain',
            asks: [
              'Refrigeration temperatures are recorded at least twice a day',
              'Refrigerated products are kept between 0 °C and 5 °C',
            ],
          },
        ],
      },
    ],
  },
];

// ============================ SEEDING =============================

export async function seedFormTemplates() {
  const existing = await prisma.formTemplate.findFirst({ where: { name: TEMPLATE_NAME } });
  if (existing) {
    logSeed('form-templates (árbol)', 0, 1);
    return;
  }

  let asksCreated = 0;

  const template = await prisma.formTemplate.create({
    data: { name: TEMPLATE_NAME, active: true, createAt: new Date() },
  });

  for (const h1Seed of TREE) {
    const h1 = await prisma.h1.create({
      data: {
        name: h1Seed.name,
        formTemplateId: template.formTemplateId,
        // `form_id` es una columna heredada del ERD original que duplica la
        // referencia a la plantilla; se mantiene consistente con formTemplateId.
        formId: template.formTemplateId,
      },
    });
    for (const name of h1Seed.asks) {
      await prisma.h1Ask.create({ data: { name, h1Id: h1.h1Id, active: true } });
      asksCreated++;
    }

    for (const h2Seed of h1Seed.h2s ?? []) {
      const h2 = await prisma.h2.create({ data: { name: h2Seed.name, h1Id: h1.h1Id } });
      for (const name of h2Seed.asks) {
        await prisma.h2Ask.create({ data: { name, h2Id: h2.h2Id, active: true } });
        asksCreated++;
      }

      for (const h3Seed of h2Seed.h3s ?? []) {
        const h3 = await prisma.h3.create({ data: { name: h3Seed.name, h2Id: h2.h2Id } });
        for (const name of h3Seed.asks) {
          await prisma.h3Ask.create({ data: { name, h3Id: h3.h3Id, active: true } });
          asksCreated++;
        }

        for (const h4Seed of h3Seed.h4s ?? []) {
          const h4 = await prisma.h4.create({ data: { name: h4Seed.name, h3Id: h3.h3Id } });
          for (const name of h4Seed.asks) {
            await prisma.h4Ask.create({ data: { name, h4Id: h4.h4Id, active: true } });
            asksCreated++;
          }
        }
      }
    }
  }

  console.log(`[seed] form-templates           1 plantilla "${TEMPLATE_NAME}" con ${asksCreated} preguntas`);
}
