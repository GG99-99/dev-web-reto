import prisma from '@reto/db';
import type { UserRole } from '@reto/shared';
import { logSeed } from './seed.utils';

/**
 * roles.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `role`. RF-02 / RNF-02.
 * Prerequisito de TODO lo demás: `User.roleId` es FK y `validateRole`
 * compara contra estos nombres (enum `UserRole` de @reto/shared).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const ROLES: { name: UserRole; description: string }[] = [
  { name: 'ADMIN', description: 'Administrador del sistema' },
  { name: 'ADMIN_EMPRESA', description: 'Administrador de una empresa/institución' },
  { name: 'USUARIO_DELEGADO', description: 'Usuario delegado por el Admin Empresa' },
  { name: 'COORDINADOR', description: 'Coordinador de evaluaciones' },
  { name: 'TECNICO_EVALUADOR', description: 'Técnico que ejecuta evaluaciones en campo' },
];

// ============================ SEEDING =============================

export async function seedRoles() {
  let created = 0;
  let skipped = 0;

  for (const role of ROLES) {
    const existing = await prisma.role.findUnique({ where: { name: role.name } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.role.create({ data: role });
    created++;
  }

  logSeed('roles', created, skipped);
}
