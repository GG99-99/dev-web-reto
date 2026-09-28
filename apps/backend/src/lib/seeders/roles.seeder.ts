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
  { name: 'ADMIN', description: 'System administrator' },
  { name: 'ADMIN_EMPRESA', description: 'Administrator of a company or institution' },
  { name: 'USUARIO_DELEGADO', description: 'User delegated by the company administrator' },
  { name: 'COORDINADOR', description: 'Evaluation coordinator' },
  { name: 'TECNICO_EVALUADOR', description: 'Technician who carries out field evaluations' },
];

// ============================ SEEDING =============================

export async function seedRoles() {
  let created = 0;
  let skipped = 0;

  for (const role of ROLES) {
    const existing = await prisma.role.findUnique({ where: { name: role.name } });
    if (existing) {
      if (existing.description !== role.description) {
        await prisma.role.update({ where: { name: role.name }, data: { description: role.description } });
      }
      skipped++;
      continue;
    }
    await prisma.role.create({ data: role });
    created++;
  }

  logSeed('roles', created, skipped);
}
