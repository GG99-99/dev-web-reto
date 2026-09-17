import prisma from '@reto/db';
import { logSeed, required } from './seed.utils';

/**
 * municipalities.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `municipality`. Catálogo de apoyo a RF-03
 * (GET /catalogs/municipalities?provinceId=).
 *
 * DEPENDE DE: provinces.seeder.ts (se resuelve la FK por nombre de provincia).
 * `Municipality.name` NO es único en el schema (dos provincias pueden tener
 * un municipio homónimo), así que la clave natural usada aquí es el par
 * (provinceId, name).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const MUNICIPALITIES: { province: string; names: string[] }[] = [
  { province: 'Distrito Nacional', names: ['Santo Domingo de Guzmán'] },
  { province: 'Santo Domingo', names: ['Santo Domingo Este', 'Santo Domingo Norte', 'Santo Domingo Oeste', 'Boca Chica'] },
  { province: 'Santiago', names: ['Santiago de los Caballeros', 'Tamboril', 'Villa González'] },
  { province: 'La Vega', names: ['La Concepción de La Vega', 'Jarabacoa', 'Constanza'] },
  { province: 'San Cristóbal', names: ['San Cristóbal', 'Bajos de Haina'] },
  { province: 'Duarte', names: ['San Francisco de Macorís'] },
  { province: 'Puerto Plata', names: ['Puerto Plata', 'Sosúa'] },
  { province: 'La Altagracia', names: ['Higüey', 'Punta Cana'] },
  { province: 'San Pedro de Macorís', names: ['San Pedro de Macorís'] },
  { province: 'Espaillat', names: ['Moca'] },
];

// ============================ SEEDING =============================

export async function seedMunicipalities() {
  let created = 0;
  let skipped = 0;

  for (const group of MUNICIPALITIES) {
    const province = required(
      await prisma.province.findUnique({ where: { name: group.province } }),
      `provincia "${group.province}" (corre provinces.seeder primero)`,
    );

    for (const name of group.names) {
      const existing = await prisma.municipality.findFirst({
        where: { provinceId: province.provinceId, name },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.municipality.create({ data: { name, provinceId: province.provinceId } });
      created++;
    }
  }

  logSeed('municipalities', created, skipped);
}
