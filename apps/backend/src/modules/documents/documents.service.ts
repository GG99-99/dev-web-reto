import type { DocumentAuthenticitySeal, DocumentVerification } from '@reto/shared';
import prisma from '@reto/db';
import {
  caseDigest,
  caseReference,
  evaluationDigest,
  evaluationReference,
  qrDataUrl,
  readSeal,
  signSeal,
  verificationUrl,
  type CaseDigestInput,
  type EvaluationDigestInput,
} from '@/lib/documents/authenticity';

/**
 * Issues and checks the QR seals printed on official reports.
 * The public check does not require a session: anyone who scans the QR
 * can confirm whether this system issued that document.
 */

const REJECTED: DocumentVerification = {
  outcome: 'rejected',
  issuedBySystem: false,
  message: 'This QR was not issued by RADAR Sanitario. The document cannot be confirmed.',
  document: null,
};

function percentLabel(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'not recorded';
  return `${value.toFixed(1)}%`;
}

async function sealFor(origin: string, claims: { kind: 'evaluation' | 'case'; id: number; version: number; digest: string }, reference: string): Promise<DocumentAuthenticitySeal> {
  const token = signSeal(claims);
  const url = verificationUrl(origin, token);
  return {
    verificationUrl: url,
    qrDataUrl: await qrDataUrl(url),
    reference,
  };
}

export const documentsService = {
  issueEvaluationSeal: (input: EvaluationDigestInput, origin: string) => sealFor(origin, {
    kind: 'evaluation',
    id: input.evaluationId,
    version: input.version,
    digest: evaluationDigest(input),
  }, evaluationReference(input.evaluationId)),

  issueCaseSeal: (input: CaseDigestInput, origin: string) => sealFor(origin, {
    kind: 'case',
    id: input.caseId,
    version: 1,
    digest: caseDigest(input),
  }, caseReference(input.caseId)),

  verify: async (token: string): Promise<DocumentVerification> => {
    const claims = readSeal(token);
    if (!claims) return REJECTED;
    if (claims.kind === 'evaluation') return verifyEvaluation(claims.id, claims.digest);
    return verifyCase(claims.id, claims.digest, claims.version);
  },
};

async function verifyEvaluation(evaluationId: number, digest: string): Promise<DocumentVerification> {
  const report = await prisma.evaluationReport.findUnique({
    where: { evaluationId },
    include: {
      evaluation: {
        include: {
          institution: { select: { name: true, rnc: true } },
          score: true,
        },
      },
    },
  });

  if (!report) {
    return {
      outcome: 'outdated',
      issuedBySystem: true,
      message: 'This QR was issued by RADAR Sanitario, but that record is no longer available.',
      document: null,
    };
  }

  const institution = report.evaluation.institution;
  const score = report.evaluation.score;
  const document = {
    kind: 'evaluation' as const,
    reference: evaluationReference(evaluationId),
    title: 'Official health inspection report',
    establishment: institution.name,
    statusLabel: report.status === 'APROBADO' ? 'Approved official report' : 'Not an approved official report',
    version: report.version,
    summary: score
      ? `Risk level ${score.nivelRiesgo}. Compliance ${percentLabel(score.porcentajeCumplimiento)}.`
      : `Report version ${report.version}.`,
  };

  if (report.status !== 'APROBADO') {
    return {
      outcome: 'outdated',
      issuedBySystem: true,
      message: 'This QR was issued by RADAR Sanitario, but the report is not an approved official document.',
      document,
    };
  }

  const current = evaluationDigest({
    evaluationId,
    reportId: report.reportId,
    version: report.version,
    status: report.status,
    resumenEjecutivo: report.resumenEjecutivo,
    hallazgos: report.hallazgos,
    noConformidades: report.noConformidades,
    recomendaciones: report.recomendaciones,
    nivelRiesgo: score?.nivelRiesgo ?? '',
    porcentajeCumplimiento: score?.porcentajeCumplimiento ?? null,
    establishmentName: institution.name,
    rnc: institution.rnc ?? '',
  });

  if (current !== digest) {
    return {
      outcome: 'outdated',
      issuedBySystem: true,
      message: 'This QR was issued by RADAR Sanitario, but it does not match the current official record. Ask for the latest approved copy.',
      document,
    };
  }

  return {
    outcome: 'confirmed',
    issuedBySystem: true,
    message: 'This document was issued by RADAR Sanitario and matches the current official record.',
    document,
  };
}

async function verifyCase(caseId: number, digest: string, version: number): Promise<DocumentVerification> {
  const found = await prisma.case.findUnique({
    where: { caseId },
    include: {
      institution: { select: { name: true, rnc: true } },
      attachments: {
        where: { category: 'INFORME_OFICIAL_PDF' },
        select: { attachmentId: true },
        take: 1,
      },
    },
  });

  if (!found) {
    return {
      outcome: 'outdated',
      issuedBySystem: true,
      message: 'This QR was issued by RADAR Sanitario, but that record is no longer available.',
      document: null,
    };
  }

  const document = {
    kind: 'case' as const,
    reference: caseReference(caseId),
    title: 'Official case report',
    establishment: found.institution.name,
    statusLabel: found.status === 'CERRADO' && found.attachments.length > 0
      ? 'Official closing report'
      : 'Not an official closing report',
    version: 1,
    summary: found.resultadoFinal
      ? `Final result: ${found.resultadoFinal}`
      : 'No final result is recorded.',
  };

  const official = found.status === 'CERRADO' && Boolean(found.resultadoFinal) && found.attachments.length > 0;
  if (!official || !found.resultadoFinal) {
    return {
      outcome: 'outdated',
      issuedBySystem: true,
      message: 'This QR was issued by RADAR Sanitario, but this case does not currently have an official report.',
      document,
    };
  }

  const current = caseDigest({
    caseId,
    resultadoFinal: found.resultadoFinal,
    establishmentName: found.institution.name,
    rnc: found.institution.rnc ?? '',
  });

  if (current !== digest || version !== 1) {
    return {
      outcome: 'outdated',
      issuedBySystem: true,
      message: 'This QR was issued by RADAR Sanitario, but it does not match the current official report.',
      document,
    };
  }

  return {
    outcome: 'confirmed',
    issuedBySystem: true,
    message: 'This document was issued by RADAR Sanitario and matches the current official report.',
    document,
  };
}
