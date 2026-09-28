import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';

/**
 * lapch-alerts.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `lapch_alert`. RF-08 (sección 8 del contrato).
 *
 * DEPENDE DE: institutions.seeder.ts.
 * Se siembra una alerta de cada tipo para cubrir las ramas del módulo:
 *   - resultado = null         -> probar PATCH /lapch-alerts/:id/resultado
 *   - resultado = PROCEDE      -> probar POST .../generate-case
 *   - resultado = NO_PROCEDE   -> probar el 409 de generate-case
 * Clave natural: `numeroAlerta`.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const LAPCH_ALERTS: {
  numeroAlerta: string;
  rnc: string;
  fechaDays: number;
  producto: string;
  descripcion: string;
  resultado: 'PROCEDE' | 'NO_PROCEDE' | null;
}[] = [
  {
    numeroAlerta: 'LAPCH-2026-001',
    rnc: '130123456',
    fechaDays: -15,
    producto: 'Frying cheese, lot QF-0425',
    descripcion: 'Positive result for Listeria monocytogenes in a market sample.',
    resultado: 'PROCEDE',
  },
  {
    numeroAlerta: 'LAPCH-2026-002',
    rnc: '130987654',
    fechaDays: -9,
    producto: 'Vanilla cake, lot BV-1102',
    descripcion: 'Mold count above the allowed limit.',
    resultado: null,
  },
  {
    numeroAlerta: 'LAPCH-2026-003',
    rnc: '130555777',
    fechaDays: -4,
    producto: 'Canned beans, lot HE-8890',
    descripcion: 'Report of swollen cans; later analysis found no issues.',
    resultado: 'NO_PROCEDE',
  },
];

// ============================ SEEDING =============================

export async function seedLapchAlerts() {
  let created = 0;
  let skipped = 0;

  for (const item of LAPCH_ALERTS) {
    const existing = await prisma.lapchAlert.findFirst({ where: { numeroAlerta: item.numeroAlerta } });
    if (existing) {
      skipped++;
      continue;
    }

    const institution = required(
      await prisma.institution.findFirst({ where: { rnc: item.rnc } }),
      `institución con RNC ${item.rnc} (corre institutions.seeder primero)`,
    );

    await prisma.lapchAlert.create({
      data: {
        numeroAlerta: item.numeroAlerta,
        institutionId: institution.institutionId,
        fecha: daysFromNow(item.fechaDays),
        producto: item.producto,
        descripcion: item.descripcion,
        resultado: item.resultado,
      },
    });
    created++;
  }

  logSeed('lapch-alerts', created, skipped);
}
