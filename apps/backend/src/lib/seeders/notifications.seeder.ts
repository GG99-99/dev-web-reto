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
    title: 'Solicitud recibida',
    message: 'Su solicitud de certificación BPM fue recibida y está pendiente de asignación.',
    read: true,
    createdDays: -20,
  },
  {
    cedula: '002-0000001-1',
    title: 'Evaluación programada',
    message: 'Se programó una evaluación para Lácteos del Norte. Revise la fecha en su panel.',
    read: false,
    createdDays: -3,
  },
  {
    cedula: '002-0000001-1',
    title: 'Alerta LAPCH asociada a su empresa',
    message: 'Se registró la alerta LAPCH-2026-001 vinculada a uno de sus productos.',
    read: false,
    createdDays: -14,
  },
  {
    cedula: '002-0000003-3',
    title: 'Registro pendiente de validación',
    message: 'Su registro está pendiente de aprobación por parte de un administrador.',
    read: false,
    createdDays: -8,
  },
  {
    cedula: '001-0000003-3',
    title: 'Nuevo caso asignado',
    message: 'Se le asignó el caso de Lácteos del Norte (solicitud inicial BPM).',
    read: false,
    createdDays: -19,
  },
  {
    cedula: '001-0000004-4',
    title: 'Informe devuelto para corrección',
    message: 'El coordinador solicitó correcciones en el informe de Distribuidora Caribe.',
    read: false,
    createdDays: -1,
  },
  {
    cedula: '001-0000002-2',
    title: 'Informe enviado a revisión',
    message: 'Hay un informe pendiente de su revisión.',
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
