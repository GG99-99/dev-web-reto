import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';

/**
 * sa-permits.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `sa_permit` (Permiso Sanitario).
 *
 * DEPENDE DE: form-responses.seeder.ts e institutions.seeder.ts
 * (`formResponseId` e `institutionId` son FKs obligatorias).
 *
 * Modelo heredado del ERD original. Ningún endpoint del contrato lo escribe
 * todavía, pero SÍ se lee: `GET /institutions/:id/history` devuelve los
 * `saPermits` de la institución (ver InstitutionHistoryResponse, sección 3),
 * así que sin esta data ese arreglo siempre saldría vacío.
 *
 * Clave natural: `formResponseId` (un permiso por ficha diligenciada).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const SA_PERMITS: {
  /** Ficha (FormResponse) que sustenta el permiso, por su `name`. */
  formResponseName: string;
  rnc: string;
  expirationDays: number;
  valid: boolean;
}[] = [
  {
    formResponseName: 'Ficha BPM — Panadería El Sol (inicial)',
    rnc: '130987654',
    expirationDays: 330,
    valid: true,
  },
  {
    formResponseName: 'Ficha BPM — Distribuidora Caribe (rutina)',
    rnc: '130555777',
    expirationDays: -10, // vencido
    valid: false,
  },
];

// ============================ SEEDING =============================

export async function seedSaPermits() {
  let created = 0;
  let skipped = 0;

  for (const item of SA_PERMITS) {
    const formResponse = required(
      await prisma.formResponse.findFirst({ where: { name: item.formResponseName } }),
      `ficha "${item.formResponseName}" (corre form-responses.seeder primero)`,
    );

    const existing = await prisma.saPermit.findFirst({
      where: { formResponseId: formResponse.formResponseId },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const institution = required(
      await prisma.institution.findFirst({ where: { rnc: item.rnc } }),
      `institución con RNC ${item.rnc}`,
    );

    await prisma.saPermit.create({
      data: {
        formResponseId: formResponse.formResponseId,
        institutionId: institution.institutionId,
        expiration: daysFromNow(item.expirationDays),
        valid: item.valid,
      },
    });
    created++;
  }

  logSeed('sa-permits', created, skipped);
}
