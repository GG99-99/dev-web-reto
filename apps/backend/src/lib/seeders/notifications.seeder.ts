import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';

/**
 * notifications.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `notification`. Soporte a RF-04 (sección 16 del contrato).
 *
 * DEPENDE DE: users.seeder.ts.
 * Se siembran leídas y NO leídas: el contador `notificacionesNoLeidas` del
 * dashboard de empresa y el filtro `GET /notifications?read=false` necesitan
 * ambas para poder verificarse.
 * Clave natural: el trío (userId, title, message).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const NOTIFICATIONS: {
  cedula: string;
  title: string;
  message: string;
  read: boolean;
  createdDays: number;
}[] = [
  {
    cedula: '002-0000001-1',
    title: 'Request received',
    message: 'Your BPM certification request was received and is pending assignment.',
    read: true,
    createdDays: -20,
  },
  {
    cedula: '002-0000001-1',
    title: 'Evaluation scheduled',
    message: 'An evaluation was scheduled for Lácteos del Norte. Check the date in your dashboard.',
    read: false,
    createdDays: -3,
  },
  {
    cedula: '002-0000001-1',
    title: 'LAPCH alert linked to your company',
    message: 'Alert LAPCH-2026-001 was recorded and linked to one of your products.',
    read: false,
    createdDays: -14,
  },
  {
    cedula: '002-0000003-3',
    title: 'Registration pending validation',
    message: 'Your registration is pending approval by an administrator.',
    read: false,
    createdDays: -8,
  },
  {
    cedula: '001-0000003-3',
    title: 'New case assigned',
    message: 'The Lácteos del Norte case (initial BPM request) was assigned to you.',
    read: false,
    createdDays: -19,
  },
  {
    cedula: '001-0000004-4',
    title: 'Report returned for correction',
    message: 'The coordinator requested corrections on the Distribuidora Caribe report.',
    read: false,
    createdDays: -1,
  },
  {
    cedula: '001-0000002-2',
    title: 'Report sent for review',
    message: 'A report is waiting for your review.',
    read: true,
    createdDays: -6,
  },
];

// ============================ SEEDING =============================

export async function seedNotifications() {
  let created = 0;
  let skipped = 0;

  for (const item of NOTIFICATIONS) {
    const person = required(
      await prisma.person.findUnique({ where: { cedula: item.cedula } }),
      `persona con cédula ${item.cedula}`,
    );
    const user = required(
      await prisma.user.findUnique({ where: { personId: person.personId } }),
      `usuario de ${item.cedula} (corre users.seeder primero)`,
    );

    const existing = await prisma.notification.findFirst({
      where: { userId: user.userId, title: item.title, message: item.message },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.notification.create({
      data: {
        userId: user.userId,
        title: item.title,
        message: item.message,
        read: item.read,
        createdAt: daysFromNow(item.createdDays),
      },
    });
    created++;
  }

  logSeed('notifications', created, skipped);
}
