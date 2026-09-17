import prisma from '@reto/db';
import type { UserRole } from '@reto/shared';

/**
 * roles.seeder.ts
 * ---------------------------------------------------------------------------
 * Crea (si no existen) los 5 roles del sistema (`UserRole` en
 * @reto/shared/common.ts). Es un prerequisito para poder registrar usuarios
 * (`roleId` es FK obligatoria) y para las validaciones RBAC (`validateRole`).
 *
 * Uso: node --import tsx src/seeders/roles.seeder.ts
 * (o vía `pnpm --filter @reto/backend exec tsx src/seeders/roles.seeder.ts`)
 * ---------------------------------------------------------------------------
 */

const ROLES: { name: UserRole; description: string }[] = [
  { name: 'ADMIN', description: 'Administrador del sistema' },
  { name: 'ADMIN_EMPRESA', description: 'Administrador de una empresa/institución' },
  { name: 'USUARIO_DELEGADO', description: 'Usuario delegado por el Admin Empresa' },
  { name: 'COORDINADOR', description: 'Coordinador de evaluaciones' },
  { name: 'TECNICO_EVALUADOR', description: 'Técnico que ejecuta evaluaciones en campo' },
];

export async function seedRoles() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
  console.log(`[seed] ${ROLES.length} roles verificados/creados`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedRoles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] error', err);
      process.exit(1);
    });
}
