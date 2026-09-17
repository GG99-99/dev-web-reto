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

const TEMPLATE_NAME = 'Ficha Inspección BPM v1.00';

const TREE: H1Seed[] = [
  {
    name: '1. ESTABLECIMIENTO',
    asks: ['El establecimiento cuenta con permiso sanitario vigente'],
    h2s: [
      {
        name: '1.1 Ubicación y alrededores',
        asks: ['Los alrededores están libres de acumulación de basura'],
        h3s: [
          {
            name: '1.1.1 Ubicación del establecimiento',
            asks: [
              'Está alejado de focos de contaminación',
              'Las vías de acceso están pavimentadas o tratadas contra el polvo',
            ],
          },
          {
            name: '1.1.2 Estructura física',
            asks: ['La estructura es de material resistente y de fácil limpieza'],
            h4s: [
              {
                name: '1.1.2.1 Paredes',
                asks: [
                  'Las paredes son lisas, impermeables y de color claro',
                  'Las uniones pared-piso son redondeadas (sanitarias)',
                ],
              },
              {
                name: '1.1.2.2 Pisos',
                asks: [
                  'Los pisos son impermeables y antideslizantes',
                  'Los pisos tienen pendiente hacia los desagües',
                ],
              },
              {
                name: '1.1.2.3 Techos',
                asks: ['Los techos impiden la acumulación de suciedad y condensación'],
              },
            ],
          },
        ],
      },
      {
        name: '1.2 Servicios básicos',
        asks: ['Existe suministro continuo de agua potable'],
        h3s: [
          {
            name: '1.2.1 Agua',
            asks: [
              'El agua utilizada cumple con los parámetros de potabilidad',
              'Se llevan registros de cloración del agua',
            ],
          },
          {
            name: '1.2.2 Manejo de residuos',
            asks: [
              'Los residuos sólidos se almacenan en recipientes tapados',
              'La disposición final de residuos es adecuada',
            ],
          },
        ],
      },
    ],
  },
  {
    name: '2. PERSONAL MANIPULADOR',
    asks: ['El personal cuenta con certificado de salud vigente'],
    h2s: [
      {
        name: '2.1 Higiene del personal',
        asks: ['El personal usa uniforme limpio y completo'],
        h3s: [
          {
            name: '2.1.1 Prácticas higiénicas',
            asks: [
              'El personal se lava las manos al ingresar al área de proceso',
              'El personal no usa joyas ni maquillaje en el área de proceso',
              'Existen avisos alusivos a la higiene en lugares visibles',
            ],
          },
          {
            name: '2.1.2 Capacitación',
            asks: ['Existe un programa de capacitación en BPM documentado'],
          },
        ],
      },
    ],
  },
  {
    name: '3. PROCESO Y PRODUCCIÓN',
    asks: ['Existe documentación del proceso productivo'],
    h2s: [
      {
        name: '3.1 Materias primas',
        asks: ['Las materias primas se inspeccionan al recibirlas'],
        h3s: [
          {
            name: '3.1.1 Almacenamiento',
            asks: [
              'Las materias primas se almacenan sobre tarimas separadas de la pared',
              'Se aplica el principio PEPS (primero en entrar, primero en salir)',
            ],
          },
        ],
      },
      {
        name: '3.2 Control de temperatura',
        asks: ['Los equipos de frío cuentan con termómetro visible'],
        h3s: [
          {
            name: '3.2.1 Cadena de frío',
            asks: [
              'Se registran las temperaturas de refrigeración al menos 2 veces al día',
              'Los productos refrigerados se mantienen entre 0 °C y 5 °C',
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
