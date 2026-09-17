import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';
import { EVAL_REASONS } from './evaluations.seeder';

/**
 * evidences.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `evidence`. RF-15 (sección 13 del contrato).
 *
 * DEPENDE DE: evaluations.seeder.ts.
 *
 * ⚠️ IMPORTANTE: `fileUrl` apunta a rutas bajo /uploads que NO existen en
 * disco (el seeder no sube archivos reales). Los metadatos sirven para probar
 * GET /evaluations/:id/evidences y DELETE /evidences/:id; la descarga del
 * archivo dará 404 hasta que se suba uno de verdad vía
 * POST /evaluations/:id/evidences (multipart). El DELETE igual funciona: el
 * service hace `fs.unlink(...).catch(() => undefined)`.
 *
 * Clave natural: el par (evaluationId, fileUrl).
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const EVIDENCES: {
  evaluationReason: string;
  type: 'FOTO' | 'VIDEO' | 'DOCUMENTO';
  fileUrl: string;
  comment: string;
  latitude?: number;
  longitude?: number;
  capturedDays: number;
}[] = [
  {
    evaluationReason: EVAL_REASONS.PANADERIA_INICIAL,
    type: 'FOTO',
    fileUrl: '/uploads/seed-panaderia-area-amasado.jpg',
    comment: 'Área de amasado en condiciones adecuadas.',
    latitude: 18.4861,
    longitude: -69.8697,
    capturedDays: -28,
  },
  {
    evaluationReason: EVAL_REASONS.PANADERIA_INICIAL,
    type: 'DOCUMENTO',
    fileUrl: '/uploads/seed-panaderia-certificados-salud.pdf',
    comment: 'Certificados de salud del personal manipulador.',
    capturedDays: -28,
  },
  {
    evaluationReason: EVAL_REASONS.DISTRIBUIDORA_RUTINA,
    type: 'FOTO',
    fileUrl: '/uploads/seed-caribe-camara-frio.jpg',
    comment: 'Termómetro de la cámara de frío sin calibración vigente.',
    latitude: 18.5601,
    longitude: -69.9312,
    capturedDays: -1,
  },
  {
    evaluationReason: EVAL_REASONS.DISTRIBUIDORA_RUTINA,
    type: 'VIDEO',
    fileUrl: '/uploads/seed-caribe-recorrido-almacen.mp4',
    comment: 'Recorrido general del almacén.',
    latitude: 18.5601,
    longitude: -69.9312,
    capturedDays: -1,
  },
];

// ============================ SEEDING =============================

export async function seedEvidences() {
  let created = 0;
  let skipped = 0;

  for (const item of EVIDENCES) {
    const evaluation = required(
      await prisma.evaluation.findFirst({ where: { reason: item.evaluationReason } }),
      `evaluación "${item.evaluationReason}" (corre evaluations.seeder primero)`,
    );

    const existing = await prisma.evidence.findFirst({
      where: { evaluationId: evaluation.evaluationId, fileUrl: item.fileUrl },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.evidence.create({
      data: {
        evaluationId: evaluation.evaluationId,
        type: item.type,
        fileUrl: item.fileUrl,
        comment: item.comment,
        latitude: item.latitude,
        longitude: item.longitude,
        capturedAt: daysFromNow(item.capturedDays),
      },
    });
    created++;
  }

  logSeed('evidences', created, skipped);
}
