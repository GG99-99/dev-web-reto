import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';
import { EVAL_REASONS } from './evaluations.seeder';

/**
 * attachments.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `attachment`. Sección 17 del contrato (adjuntos genéricos).
 *
 * DEPENDE DE: users, bpm-requests, cases y evaluation-reports.
 *
 * Tabla polimórfica: por fila va poblada COMO MÁXIMO UNA de las FKs
 * (`bpmRequestId`, `evaluationReportId`, `caseId`, `userRegistrationId`).
 * Se siembra una de cada tipo para cubrir las categorías del enum
 * `AttachmentCategory` que usan los distintos módulos.
 *
 * ⚠️ Igual que en evidences: los `fileUrl` apuntan a archivos que NO existen
 * en disco. Sirven para probar los metadatos (GET/DELETE /attachments/:id);
 * para probar la descarga real hay que subir con POST /attachments.
 *
 * Clave natural: `fileUrl`.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const ATTACHMENTS: {
  category:
    | 'CARTA_AUTORIZACION'
    | 'DOCUMENTACION_OBLIGATORIA'
    | 'EVIDENCIA_FOTO'
    | 'EVIDENCIA_DOCUMENTO'
    | 'INFORME_ADJUNTO'
    | 'INFORME_OFICIAL_PDF'
    | 'OTRO';
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedByCedula: string;
  createdDays: number;
  /** Vínculo opcional — solo uno de estos por fila. */
  bpmRequestMotivo?: { rnc: string; motivo: string };
  caseRef?: { rnc: string; origin: string };
  reportEvaluationReason?: string;
}[] = [
  {
    category: 'CARTA_AUTORIZACION',
    fileName: 'carta-autorizacion-delegado.pdf',
    fileUrl: '/uploads/seed-carta-autorizacion-delegado.pdf',
    mimeType: 'application/pdf',
    uploadedByCedula: '002-0000002-2',
    createdDays: -40,
  },
  {
    category: 'DOCUMENTACION_OBLIGATORIA',
    fileName: 'registro-mercantil-lacteos.pdf',
    fileUrl: '/uploads/seed-registro-mercantil-lacteos.pdf',
    mimeType: 'application/pdf',
    uploadedByCedula: '002-0000001-1',
    createdDays: -21,
    bpmRequestMotivo: { rnc: '130123456', motivo: 'Solicitud inicial de certificación BPM' },
  },
  {
    category: 'DOCUMENTACION_OBLIGATORIA',
    fileName: 'plano-planta-lacteos.pdf',
    fileUrl: '/uploads/seed-plano-planta-lacteos.pdf',
    mimeType: 'application/pdf',
    uploadedByCedula: '002-0000001-1',
    createdDays: -21,
    bpmRequestMotivo: { rnc: '130123456', motivo: 'Solicitud inicial de certificación BPM' },
  },
  {
    category: 'INFORME_ADJUNTO',
    fileName: 'anexo-fotografico-panaderia.pdf',
    fileUrl: '/uploads/seed-anexo-fotografico-panaderia.pdf',
    mimeType: 'application/pdf',
    uploadedByCedula: '001-0000004-4',
    createdDays: -26,
    reportEvaluationReason: EVAL_REASONS.PANADERIA_INICIAL,
  },
  {
    category: 'INFORME_OFICIAL_PDF',
    fileName: 'informe-oficial-cierre-panaderia.pdf',
    fileUrl: '/uploads/seed-informe-oficial-cierre-panaderia.pdf',
    mimeType: 'application/pdf',
    uploadedByCedula: '001-0000002-2',
    createdDays: -2,
    caseRef: { rnc: '130987654', origin: 'SOLICITUD_EMPRESA' },
  },
];

// ========================== HELPERS ===============================

async function userIdByCedula(cedula: string): Promise<number> {
  const person = required(
    await prisma.person.findUnique({ where: { cedula } }),
    `persona con cédula ${cedula}`,
  );
  const user = required(
    await prisma.user.findUnique({ where: { personId: person.personId } }),
    `usuario de ${cedula} (corre users.seeder primero)`,
  );
  return user.userId;
}

// ============================ SEEDING =============================

export async function seedAttachments() {
  let created = 0;
  let skipped = 0;

  for (const item of ATTACHMENTS) {
    const existing = await prisma.attachment.findFirst({ where: { fileUrl: item.fileUrl } });
    if (existing) {
      skipped++;
      continue;
    }

    let bpmRequestId: number | null = null;
    let caseId: number | null = null;
    let evaluationReportId: number | null = null;

    if (item.bpmRequestMotivo) {
      const institution = required(
        await prisma.institution.findFirst({ where: { rnc: item.bpmRequestMotivo.rnc } }),
        `institución con RNC ${item.bpmRequestMotivo.rnc}`,
      );
      const bpm = required(
        await prisma.bpmRequest.findFirst({
          where: { institutionId: institution.institutionId, motivo: item.bpmRequestMotivo.motivo },
        }),
        `solicitud BPM "${item.bpmRequestMotivo.motivo}" (corre bpm-requests.seeder primero)`,
      );
      bpmRequestId = bpm.bpmRequestId;
    }

    if (item.caseRef) {
      const institution = required(
        await prisma.institution.findFirst({ where: { rnc: item.caseRef.rnc } }),
        `institución con RNC ${item.caseRef.rnc}`,
      );
      const found = required(
        await prisma.case.findFirst({
          where: { institutionId: institution.institutionId, origin: item.caseRef.origin as never },
        }),
        `caso ${item.caseRef.origin} de ${item.caseRef.rnc} (corre cases.seeder primero)`,
      );
      caseId = found.caseId;
    }

    if (item.reportEvaluationReason) {
      const evaluation = required(
        await prisma.evaluation.findFirst({ where: { reason: item.reportEvaluationReason } }),
        `evaluación "${item.reportEvaluationReason}"`,
      );
      const report = required(
        await prisma.evaluationReport.findUnique({ where: { evaluationId: evaluation.evaluationId } }),
        `informe de "${item.reportEvaluationReason}" (corre evaluation-reports.seeder primero)`,
      );
      evaluationReportId = report.reportId;
    }

    await prisma.attachment.create({
      data: {
        category: item.category,
        fileName: item.fileName,
        fileUrl: item.fileUrl,
        mimeType: item.mimeType,
        uploadedById: await userIdByCedula(item.uploadedByCedula),
        createdAt: daysFromNow(item.createdDays),
        bpmRequestId,
        caseId,
        evaluationReportId,
      },
    });
    created++;
  }

  logSeed('attachments', created, skipped);
}
