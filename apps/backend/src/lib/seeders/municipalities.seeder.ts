import prisma from '@reto/db';
import { logSeed, required } from './seed.utils';

/**
 * municipalities.seeder.ts
 * ---------------------------------------------------------------------------
 * Table: `municipality`. Catalog supporting RF-03
 * (GET /catalogs/municipalities?provinceId=).
 *
 * DEPENDS ON: provinces.seeder.ts (FK resolved by province name).
 * `Municipality.name` is NOT unique in the schema (two provinces may share
 * a municipality name), so the natural key here is the pair (provinceId, name).
 *
 * All official municipalities of the Dominican Republic per the
 * Oficina Nacional de Estadística (ONE).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const MUNICIPALITIES: { province: string; names: string[] }[] = [
  {
    province: 'Distrito Nacional',
    names: ['Santo Domingo de Guzmán'],
  },
  {
    province: 'Azua',
    names: [
      'Azua', 'Estebanía', 'Guayabal', 'Las Charcas', 'Las Yayas de Viajama',
      'Padre Las Casas', 'Peralta', 'Pueblo Viejo', 'Sabana Yegua', 'Tábar',
      'Villarpando',
    ],
  },
  {
    province: 'Bahoruco',
    names: ['Neyba', 'Galván', 'Los Ríos', 'Tamayo', 'Villa Jaragua'],
  },
  {
    province: 'Barahona',
    names: [
      'Barahona', 'Cabral', 'El Peñón', 'Enriquillo', 'Fundación',
      'Jaquimeyes', 'La Ciénaga', 'Las Salinas', 'Paraíso', 'Polo', 'Vicente Noble',
    ],
  },
  {
    province: 'Dajabón',
    names: ['Dajabón', 'El Pino', 'Loma de Cabrera', 'Partido', 'Restauración'],
  },
  {
    province: 'Duarte',
    names: [
      'San Francisco de Macorís', 'Arenoso', 'Castillo', 'Eugenio María de Hostos',
      'Las Guáranas', 'Pimentel', 'Villa Riva',
    ],
  },
  {
    province: 'Elías Piña',
    names: ['Comendador', 'Bánica', 'El Llano', 'Hondo Valle', 'Juan Santiago', 'Pedro Santana'],
  },
  {
    province: 'El Seibo',
    names: ['El Seibo', 'Miches'],
  },
  {
    province: 'Espaillat',
    names: ['Moca', 'Cayetano Germosén', 'Gaspar Hernández', 'Jamao al Norte'],
  },
  {
    province: 'Hato Mayor',
    names: ['Hato Mayor del Rey', 'El Valle', 'Sabana de la Mar'],
  },
  {
    province: 'Hermanas Mirabal',
    names: ['Salcedo', 'Tenares', 'Villa Tapia'],
  },
  {
    province: 'Independencia',
    names: ['Jimaní', 'Cristóbal', 'Duvergé', 'La Descubierta', 'Mella', 'Postrer Río'],
  },
  {
    province: 'La Altagracia',
    names: ['Higüey', 'San Rafael del Yuma', 'Punta Cana'],
  },
  {
    province: 'La Romana',
    names: ['La Romana', 'Guaymate', 'Villa Hermosa'],
  },
  {
    province: 'La Vega',
    names: ['La Concepción de La Vega', 'Constanza', 'Jarabacoa', 'Jima Abajo'],
  },
  {
    province: 'María Trinidad Sánchez',
    names: ['Nagua', 'Cabrera', 'El Factor', 'Río San Juan'],
  },
  {
    province: 'Monseñor Nouel',
    names: ['Bonao', 'Maimón', 'Piedra Blanca'],
  },
  {
    province: 'Monte Cristi',
    names: ['Monte Cristi', 'Castañuelas', 'Guayubín', 'Las Matas de Santa Cruz', 'Pepillo Salcedo', 'Villa Vásquez'],
  },
  {
    province: 'Monte Plata',
    names: ['Monte Plata', 'Bayaguana', 'Peralvillo', 'Sabana Grande de Boyá', 'Yamasá'],
  },
  {
    province: 'Pedernales',
    names: ['Pedernales', 'Oviedo'],
  },
  {
    province: 'Peravia',
    names: ['Baní', 'Nizao'],
  },
  {
    province: 'Puerto Plata',
    names: [
      'Puerto Plata', 'Altamira', 'Guananico', 'Imbert', 'Los Hidalgos',
      'Luperón', 'Sosúa', 'Villa Isabela', 'Villa Montellano',
    ],
  },
  {
    province: 'Samaná',
    names: ['Samaná', 'Las Galeras', 'Las Terrenas', 'Sánchez'],
  },
  {
    province: 'San Cristóbal',
    names: [
      'San Cristóbal', 'Bajos de Haina', 'Cambita Garabito', 'Los Cacaos',
      'Palenque', 'Sabana Grande de Palenque', 'San Gregorio de Nigua',
      'Villa Altagracia', 'Yaguate',
    ],
  },
  {
    province: 'San José de Ocoa',
    names: ['San José de Ocoa', 'Rancho Arriba', 'Sabana Larga'],
  },
  {
    province: 'San Juan',
    names: [
      'San Juan de la Maguana', 'Bohechío', 'El Cercado', 'Juan de Herrera',
      'Las Matas de Farfán', 'Vallejuelo',
    ],
  },
  {
    province: 'San Pedro de Macorís',
    names: [
      'San Pedro de Macorís', 'Consuelo', 'Guayacanes', 'Quisqueya',
      'Ramón Santana', 'San José de Los Llanos',
    ],
  },
  {
    province: 'Sánchez Ramírez',
    names: ['Cotuí', 'Cevicos', 'Fantino', 'La Mata'],
  },
  {
    province: 'Santiago',
    names: [
      'Santiago de los Caballeros', 'Bisonó', 'Jánico', 'Licey al Medio',
      'Puñal', 'Sabana Iglesia', 'San José de Las Matas', 'Tamboril',
      'Villa González',
    ],
  },
  {
    province: 'Santiago Rodríguez',
    names: ['Sabaneta', 'Los Almácigos', 'Monción'],
  },
  {
    province: 'Santo Domingo',
    names: [
      'Santo Domingo Este', 'Santo Domingo Norte', 'Santo Domingo Oeste',
      'Boca Chica', 'Los Alcarrizos', 'Pedro Brand', 'San Antonio de Guerra',
    ],
  },
  {
    province: 'Valverde',
    names: ['Mao', 'Esperanza', 'Laguna Salada'],
  },
];

// ============================ SEEDING =============================

export async function seedMunicipalities() {
  let created = 0;
  let skipped = 0;

  for (const group of MUNICIPALITIES) {
    const province = required(
      await prisma.province.findUnique({ where: { name: group.province } }),
      `province "${group.province}" (run provinces.seeder first)`,
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
