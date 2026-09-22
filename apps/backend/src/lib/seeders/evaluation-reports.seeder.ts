import prisma from '@reto/db';
import { daysFromNow, logSeed, required } from './seed.utils';
import { EVAL_REASONS } from './evaluations.seeder';

/**
 * evaluation-reports.seeder.ts
 * ---------------------------------------------------------------------------
 * Tabla: `evaluation_report`. RF-16 (sección 14 del contrato).
 *
 * DEPENDE DE: evaluations.seeder.ts.
 * En producción lo genera automáticamente `reports.autoGenerate()` al
 * finalizar la evaluación; aquí se siembra para tener informes en distintos
 * estados del flujo RF-16/17/18 sin simular la inspección completa:
 *   - APROBADO (locked)      -> caso cerrado
 *   - EN_CORRECCION (abierto)-> probar POST /reports/:id/correct y /resend
 *
 * `evaluationId` es @unique: máximo 1 informe por evaluación.
 * ---------------------------------------------------------------------------
 */

// ============================== DATA ==============================

const REPORTS: {
  evaluationReason: string;
  resumenEjecutivo: string;
  hallazgos: string;
  noConformidades: string;
  recomendaciones: string;
  status: 'BORRADOR' | 'ENVIADO' | 'APROBADO' | 'DEVUELTO' | 'EN_CORRECCION';
  version: number;
  locked: boolean;
  generatedDays: number;
}[] = [
  {
    evaluationReason: EVAL_REASONS.PANADERIA_INICIAL,
    resumenEjecutivo:
      'El establecimiento cumple con la mayoría de los requisitos de Buenas Prácticas de Manufactura evaluados. Se identificaron observaciones menores subsanables en el corto plazo.',
    hallazgos:
      'Infraestructura en buen estado general. Personal con certificados de salud vigentes. Registros de limpieza y desinfección disponibles y actualizados.',
    noConformidades:
      'Cumplimiento parcial en la señalización de higiene en el área de despacho. No se evidenció registro documentado del programa anual de capacitación en BPM.',
    recomendaciones:
      'Instalar avisos alusivos al lavado de manos en el área de despacho. Documentar y archivar el cronograma anual de capacitación del personal manipulador.',
    status: 'APROBADO',
    version: 2,
    locked: true,
    generatedDays: -27,
  },
  {
    evaluationReason: EVAL_REASONS.DISTRIBUIDORA_RUTINA,
    resumenEjecutivo:
      'Inspección de rutina con hallazgos relevantes en el control de la cadena de frío. Se requiere plan de acción correctiva.',
    hallazgos:
      'El almacén mantiene orden general y separación adecuada de tarimas. Se observaron deficiencias en el monitoreo de temperatura.',
    noConformidades:
      'Termómetro de la cámara de frío sin certificado de calibración vigente. Registros de temperatura incompletos en los últimos 30 días.',
    recomendaciones:
      'Calibrar los equipos de medición de temperatura y conservar el certificado. Implementar registro de temperatura dos veces por turno con responsable asignado.',
    status: 'ENVIADO',
    version: 1,
    locked: true,
    generatedDays: -1,
  },
];

// ============================ SEEDING =============================

export async function seedEvaluationReports() {
  let created = 0;
  let skipped = 0;

  for (const item of REPORTS) {
    const evaluation = required(
      await prisma.evaluation.findFirst({ where: { reason: item.evaluationReason } }),
      `evaluación "${item.evaluationReason}" (corre evaluations.seeder primero)`,
    );

    const existing = await prisma.evaluationReport.findUnique({
      where: { evaluationId: evaluation.evaluationId },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.evaluationReport.create({
      data: {
        evaluationId: evaluation.evaluationId,
        resumenEjecutivo: item.resumenEjecutivo,
        hallazgos: item.hallazgos,
        noConformidades: item.noConformidades,
        recomendaciones: item.recomendaciones,
        status: item.status,
        version: item.version,
        locked: item.locked,
        generatedAt: daysFromNow(item.generatedDays),
      },
    });
    created++;
  }

  logSeed('evaluation-reports', created, skipped);
}
