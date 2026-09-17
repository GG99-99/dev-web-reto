import prisma from '@reto/db';
import { logSeed } from './seed.utils';

/**
 * persons.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `person`. Base de RF-01 / RF-02 / RF-03.
 *
 * Una Person es la persona física; encima de ella se montan (en seeders
 * posteriores) el User (credenciales), el Propietary (dueño de empresa) y los
 * Represent (representantes legal/calidad/contacto).
 *
 * Clave natural: `cedula` (@unique). Las cédulas son ficticias pero respetan
 * el formato dominicano de 11 dígitos con guiones.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

export const PERSONS = [
  // --- personal del ministerio (tendrán User) ---
  { name: 'Ana María Pérez', cedula: '001-0000001-1', phone: '809-555-0101', email: 'admin@salud.gob.do' },
  { name: 'Carlos Rodríguez', cedula: '001-0000002-2', phone: '809-555-0102', email: 'coordinador@salud.gob.do' },
  { name: 'Luis Fernández', cedula: '001-0000003-3', phone: '809-555-0103', email: 'tecnico1@salud.gob.do' },
  { name: 'Rosa Jiménez', cedula: '001-0000004-4', phone: '809-555-0104', email: 'tecnico2@salud.gob.do' },

  // --- lado empresa (tendrán User) ---
  { name: 'Pedro Martínez', cedula: '002-0000001-1', phone: '829-555-0201', email: 'admin@lacteosdelnorte.do' },
  { name: 'Juana Castillo', cedula: '002-0000002-2', phone: '829-555-0202', email: 'delegado@lacteosdelnorte.do' },
  { name: 'Miguel Santana', cedula: '002-0000003-3', phone: '829-555-0203', email: 'admin@panaderiaelsol.do' },

  // --- representantes de empresa (NO tendrán User) ---
  { name: 'Laura Peña', cedula: '003-0000001-1', phone: '849-555-0301', email: 'legal@lacteosdelnorte.do' },
  { name: 'Ramón Guzmán', cedula: '003-0000002-2', phone: '849-555-0302', email: 'calidad@lacteosdelnorte.do' },
  { name: 'Carmen Vásquez', cedula: '003-0000003-3', phone: '849-555-0303', email: 'contacto@lacteosdelnorte.do' },
  { name: 'José Almonte', cedula: '003-0000004-4', phone: '849-555-0304', email: 'legal@panaderiaelsol.do' },
  { name: 'Sofía Reyes', cedula: '003-0000005-5', phone: '849-555-0305', email: 'calidad@panaderiaelsol.do' },
];

// ============================ SEEDING =============================

export async function seedPersons() {
  let created = 0;
  let skipped = 0;

  for (const person of PERSONS) {
    const existing = await prisma.person.findUnique({ where: { cedula: person.cedula } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.person.create({ data: person });
    created++;
  }

  logSeed('persons', created, skipped);
}
