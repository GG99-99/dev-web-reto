import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';

/**
 * complaints.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `complaint`. RF-09 (sección 9 del contrato).
 *
 * DEPENDE DE: institutions.seeder.ts (la FK es OPCIONAL: una denuncia
 * ciudadana puede llegar sin empresa identificada, y en ese caso
 * POST /complaints/:id/generate-case debe responder 400 — hay una fila
 * sembrada justamente para probar ese caso).
 * Clave natural: el par (denunciante, descripcion).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const COMPLAINTS: {
  tipoDenuncia: string;
  fechaRecepcionDays: number;
  denunciante: string;
  descripcion: string;
  rnc: string | null;
  resultado: 'PROCEDE' | 'NO_PROCEDE' | 'REMISION_OTRO_PROCESO' | null;
}[] = [
  {
    tipoDenuncia: 'Poor hygienic conditions',
    fechaRecepcionDays: -12,
    denunciante: 'Anonymous citizen',
    descripcion: 'Reports rodents in the dispatch area.',
    rnc: '130987654',
    resultado: 'PROCEDE',
  },
  {
    tipoDenuncia: 'Spoiled product',
    fechaRecepcionDays: -6,
    denunciante: 'María Fernández',
    descripcion: 'Bought milk with a fermented smell while still within the expiration date.',
    rnc: '130123456',
    resultado: null,
  },
  {
    tipoDenuncia: 'Misleading advertising',
    fechaRecepcionDays: -3,
    denunciante: 'Consumer Association',
    descripcion: 'Labeling includes a nutrition claim that cannot be verified.',
    rnc: null, // sin empresa asociada: generate-case debe fallar con 400
    resultado: 'REMISION_OTRO_PROCESO',
  },
];

// ============================ SEEDING =============================

export async function seedComplaints() {
  let created = 0;
  let skipped = 0;

  for (const item of COMPLAINTS) {
    const existing = await prisma.complaint.findFirst({
      where: { denunciante: item.denunciante, descripcion: item.descripcion },
    });
    if (existing) {
      skipped++;
      continue;
    }

    let institutionId: number | null = null;
    if (item.rnc) {
      const institution = required(
        await prisma.institution.findFirst({ where: { rnc: item.rnc } }),
        `institución con RNC ${item.rnc} (corre institutions.seeder primero)`,
      );
      institutionId = institution.institutionId;
    }

    await prisma.complaint.create({
      data: {
        tipoDenuncia: item.tipoDenuncia,
        fechaRecepcion: daysFromNow(item.fechaRecepcionDays),
        denunciante: item.denunciante,
        descripcion: item.descripcion,
        resultado: item.resultado,
        institutionId,
      },
    });
    created++;
  }

  logSeed('complaints', created, skipped);
}
