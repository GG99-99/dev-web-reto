import prisma from '@reto/db';
import type { UserRole } from '@reto/shared';
import { hashPassword } from '../auth/password';
import { logSeed, required } from './seed.utils';

/**
 * users.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `user`. RF-01 / RF-02 / RNF-02.
 *
 * DEPENDE DE: roles.seeder.ts y persons.seeder.ts.
 * Clave natural: `personId` (@unique) → se resuelve desde la cédula.
 *
 * ⚠️ SOLO PARA DESARROLLO: todos los usuarios comparten la misma contraseña
 * (ver SEED_PASSWORD). Nunca correr este seeder contra producción.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

/** Contraseña en claro de todos los usuarios sembrados (se hashea con bcrypt). */
export const SEED_PASSWORD = 'Password123!';

const USERS: { cedula: string; role: UserRole; status: 'APROBADO' | 'PENDIENTE_VALIDACION' }[] = [
  { cedula: '001-0000001-1', role: 'ADMIN', status: 'APROBADO' },
  { cedula: '001-0000002-2', role: 'COORDINADOR', status: 'APROBADO' },
  { cedula: '001-0000003-3', role: 'TECNICO_EVALUADOR', status: 'APROBADO' },
  { cedula: '001-0000004-4', role: 'TECNICO_EVALUADOR', status: 'APROBADO' },
  { cedula: '002-0000001-1', role: 'ADMIN_EMPRESA', status: 'APROBADO' },
  { cedula: '002-0000002-2', role: 'USUARIO_DELEGADO', status: 'APROBADO' },
  // Deliberadamente PENDIENTE_VALIDACION para poder probar
  // PATCH /users/:id/status (aprobar/rechazar registro).
  { cedula: '002-0000003-3', role: 'ADMIN_EMPRESA', status: 'PENDIENTE_VALIDACION' },
];

// ============================ SEEDING =============================

export async function seedUsers() {
  let created = 0;
  let skipped = 0;

  const password = await hashPassword(SEED_PASSWORD);

  for (const item of USERS) {
    const person = required(
      await prisma.person.findUnique({ where: { cedula: item.cedula } }),
      `persona con cédula ${item.cedula} (corre persons.seeder primero)`,
    );
    const role = required(
      await prisma.role.findUnique({ where: { name: item.role } }),
      `rol ${item.role} (corre roles.seeder primero)`,
    );

    const existing = await prisma.user.findUnique({ where: { personId: person.personId } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.user.create({
      data: {
        personId: person.personId,
        roleId: role.roleId,
        password,
        status: item.status,
        isActive: true,
      },
    });
    created++;
  }

  logSeed('users', created, skipped);
}
