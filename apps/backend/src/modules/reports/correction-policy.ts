import prisma from '@reto/db';
import {
  REPORT_NARRATIVE_SECTIONS,
  assessFormCompleteness,
  type FormAnswers,
  type ReportNarrativeField,
} from '@reto/shared';
import { ApiError } from '@/lib/common/ApiError';
import { syncBpmRequestForCase } from '../lifecycle/request-lifecycle';
import { readAnswers } from '../form-execution/form-execution.model';
import { loadEvaluationForm } from '../form-execution/form-completeness';

/**
 * Partial returns name the sections that may change.
 * A full return (DEVOLVER, or an explicit full resubmission) reopens the same record.
 */

const NARRATIVE_IDS = new Set<string>(REPORT_NARRATIVE_SECTIONS.map((section) => section.id));
const ID_BY_FIELD = new Map(REPORT_NARRATIVE_SECTIONS.map((section) => [section.field, section.id]));

export const DEFAULT_PARTIAL_SECTIONS = REPORT_NARRATIVE_SECTIONS.map((section) => section.id);

export function normalizeSectionId(raw: string): string | null {
  const value = raw.trim();
  if (ID_BY_FIELD.has(value as ReportNarrativeField)) return ID_BY_FIELD.get(value as ReportNarrativeField)!;
  if (NARRATIVE_IDS.has(value) || value === 'evidences') return value;
  if (value.startsWith('chapter:')) {
    const id = Number(value.slice('chapter:'.length));
    if (!Number.isInteger(id) || id <= 0) return null;
    return `chapter:${id}`;
  }
  return null;
}

export function readFlaggedSections(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string');
}

type ReportCorrectionState = {
  status: string;
  correctionScope: string | null;
  flaggedSections: unknown;
  resumenEjecutivo: string;
  hallazgos: string;
  noConformidades: string;
  recomendaciones: string;
};

function isPartial(report: ReportCorrectionState): boolean {
  return report.status === 'EN_CORRECCION' && report.correctionScope === 'PARCIAL';
}

export function narrativeChanges(
  report: ReportCorrectionState,
  body: Partial<Record<ReportNarrativeField, string | undefined>>,
): Partial<Record<ReportNarrativeField, string>> {
  const flagged = new Set(readFlaggedSections(report.flaggedSections));
  const partial = isPartial(report);
  const changes: Partial<Record<ReportNarrativeField, string>> = {};

  for (const section of REPORT_NARRATIVE_SECTIONS) {
    const next = body[section.field];
    if (next === undefined || next === report[section.field]) continue;
    if (partial && !flagged.has(section.id)) {
      throw ApiError.validation(
        `${section.label} was not flagged. Change only the sections the coordinator listed, unless a full resubmission was requested.`,
      );
    }
    changes[section.field] = next;
  }

  return changes;
}

async function questionIndex(evaluationId: number) {
  const loaded = await loadEvaluationForm(evaluationId);
  if (!loaded?.template) return new Map<string, { h1Id: number; askType: string; askId: number }>();
  const completeness = assessFormCompleteness(loaded.template, [], loaded.context);
  const byKey = new Map<string, { h1Id: number; askType: string; askId: number }>();
  for (const chapter of completeness.chapters) {
    for (const question of chapter.questions) {
      byKey.set(question.key, { h1Id: chapter.h1Id, askType: question.askType, askId: question.askId });
    }
  }
  return byKey;
}

export async function assertAnswerEdit(
  evaluation: { evaluationId: number; status: string },
  incoming: FormAnswers,
): Promise<{ changed: boolean }> {
  if (evaluation.status !== 'EN_CORRECCION') return { changed: false };

  const report = await prisma.evaluationReport.findUnique({ where: { evaluationId: evaluation.evaluationId } });
  if (!report) throw ApiError.conflict('This evaluation has no report to correct');
  if (report.locked) throw ApiError.forbidden('This evaluation report is locked; answers cannot be edited');

  const loaded = await loadEvaluationForm(evaluation.evaluationId);
  const existing = readAnswers(loaded?.evaluation.formResponse?.answers);
  const existingByKey = new Map(existing.map((answer) => [answer.key, answer]));
  const flagged = new Set(readFlaggedSections(report.flaggedSections));
  const partial = isPartial(report);
  const questions = await questionIndex(evaluation.evaluationId);
  let changed = false;

  for (const answer of incoming) {
    const previous = existingByKey.get(answer.key);
    const sameValue = previous?.value === answer.value;
    const sameNote = answer.note === undefined || (previous?.note ?? '').trim() === answer.note.trim();
    if (sameValue && sameNote) continue;
    if (partial) {
      const question = questions.get(answer.key);
      const chapterId = question ? `chapter:${question.h1Id}` : null;
      if (!chapterId || !flagged.has(chapterId)) {
        throw ApiError.validation(
          'That answer is outside the sections flagged for correction. The rest of the assessment stays as submitted.',
        );
      }
    }
    changed = true;
  }

  return { changed };
}

type AskRef = {
  h1AskId?: number | null;
  h2AskId?: number | null;
  h3AskId?: number | null;
  h4AskId?: number | null;
};

export async function assertEvidenceEdit(
  evaluation: { evaluationId: number; status: string },
  ask: AskRef,
): Promise<void> {
  if (evaluation.status === 'CANCELADA' || evaluation.status === 'FINALIZADA') {
    throw ApiError.conflict('Evidence is locked until the coordinator returns this evaluation for correction');
  }
  if (evaluation.status !== 'EN_CORRECCION') return;

  const report = await prisma.evaluationReport.findUnique({ where: { evaluationId: evaluation.evaluationId } });
  if (!report || report.locked) {
    throw ApiError.forbidden('This evaluation report is locked; evidence cannot be changed');
  }
  if (!isPartial(report)) return;

  const flagged = new Set(readFlaggedSections(report.flaggedSections));
  if (flagged.has('evidences')) return;

  const questions = [...(await questionIndex(evaluation.evaluationId)).values()];
  const match = questions.find(
    (question) =>
      (ask.h1AskId && question.askType === 'h1' && question.askId === ask.h1AskId) ||
      (ask.h2AskId && question.askType === 'h2' && question.askId === ask.h2AskId) ||
      (ask.h3AskId && question.askType === 'h3' && question.askId === ask.h3AskId) ||
      (ask.h4AskId && question.askType === 'h4' && question.askId === ask.h4AskId),
  );
  if (!match || !flagged.has(`chapter:${match.h1Id}`)) {
    throw ApiError.validation('Evidence can be changed only for chapters the coordinator flagged.');
  }
}

/**
 * Reports returned before the evaluation itself was reopened stay FINALIZADA.
 * Opening that record moves it back to correction without touching answers or evidence.
 */
export async function reopenStaleCorrection(evaluationId: number): Promise<void> {
  const report = await prisma.evaluationReport.findUnique({
    where: { evaluationId },
    select: {
      status: true,
      evaluation: { select: { status: true, caseId: true } },
    },
  });
  if (!report) return;
  if (report.status !== 'EN_CORRECCION' && report.status !== 'DEVUELTO') return;
  if (report.evaluation.status !== 'FINALIZADA') return;

  await prisma.evaluation.update({
    where: { evaluationId },
    data: { status: 'EN_CORRECCION' },
  });
  if (report.evaluation.caseId) {
    await prisma.case.updateMany({
      where: { caseId: report.evaluation.caseId, status: 'EN_REVISION' },
      data: { status: 'EN_EVALUACION' },
    });
    await syncBpmRequestForCase(prisma, report.evaluation.caseId);
  }
}

export async function markCorrectionProgress(evaluationId: number): Promise<void> {
  await prisma.evaluationReport.updateMany({
    where: { evaluationId, status: { in: ['EN_CORRECCION', 'DEVUELTO'] } },
    data: { correctionSavedAt: new Date() },
  });
}

export function correctionWasSaved(report: {
  correctionRequestedAt: Date | null;
  correctionSavedAt: Date | null;
}): boolean {
  if (!report.correctionRequestedAt) return true;
  if (!report.correctionSavedAt) return false;
  return report.correctionSavedAt.getTime() >= report.correctionRequestedAt.getTime();
}
