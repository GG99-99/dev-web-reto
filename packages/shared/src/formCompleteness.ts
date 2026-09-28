/**
 * formCompleteness.ts
 * ---------------------------------------------------------------------------
 * Shared rules for whether an evaluation can be finalized. Both the field
 * UI and the API use this so progress, N/A chapters, and the submit block
 * come from the form template actually assigned to the case.
 *
 * A question is required when its ask is active and its chapter applies to
 * the case. Answering N/A completes that question and excludes it from the
 * risk score. A chapter with no active questions, or whose appliesTo scope
 * does not match the case, is N/A and is not counted as incomplete.
 */

export interface FormApplicability {
  origins?: string[];
  establishmentTypes?: string[];
}

export interface FormCaseContext {
  origin?: string | null;
  establishmentType?: string | null;
  institutionActivity?: string | null;
}

export type ChapterStatus = 'complete' | 'incomplete' | 'exempt' | 'not_applicable';

export interface TemplateAskNode {
  name?: string;
  active?: boolean;
  h1AskId?: number;
  h2AskId?: number;
  h3AskId?: number;
  h4AskId?: number;
}

export interface TemplateH4Node {
  h4Id?: number;
  name?: string;
  h4Asks?: TemplateAskNode[];
}

export interface TemplateH3Node {
  h3Id?: number;
  name?: string;
  h3Asks?: TemplateAskNode[];
  h4s?: TemplateH4Node[];
}

export interface TemplateH2Node {
  h2Id?: number;
  name?: string;
  h2Asks?: TemplateAskNode[];
  h3s?: TemplateH3Node[];
}

export interface TemplateH1Node {
  h1Id?: number;
  name?: string;
  appliesTo?: unknown;
  h1Asks?: TemplateAskNode[];
  h2s?: TemplateH2Node[];
}

export interface TemplateTreeInput {
  formTemplateId?: number;
  name?: string;
  appliesTo?: unknown;
  h1s?: TemplateH1Node[];
}

export interface RequiredQuestion {
  key: string;
  txt: string;
  h1Id: number;
  chapterName: string;
  sectionName: string;
  codeLabel: string;
  askType: 'h1' | 'h2' | 'h3' | 'h4';
  askId: number;
}

export interface ChapterCompleteness {
  h1Id: number;
  name: string;
  codePrefix: string;
  status: ChapterStatus;
  answered: number;
  required: number;
  /** Why a chapter is outside the required set. */
  skipReason: 'outside_case_scope' | 'no_active_questions' | null;
  questions: RequiredQuestion[];
}

export interface FormCompleteness {
  templateId: number | null;
  templateName: string | null;
  caseLabel: string;
  requiredQuestions: number;
  answeredQuestions: number;
  percent: number;
  chapters: ChapterCompleteness[];
  applicableKeys: string[];
  canSubmit: boolean;
  blockReason: string | null;
}

const ASK_VALUES = new Set(['C', 'CP', 'NC', 'N/A']);

export function parseApplicability(raw: unknown): FormApplicability | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const origins = Array.isArray(record.origins)
    ? record.origins.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const establishmentTypes = Array.isArray(record.establishmentTypes)
    ? record.establishmentTypes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  if (origins.length === 0 && establishmentTypes.length === 0) return null;
  return { origins, establishmentTypes };
}

function specificity(scope: FormApplicability | null): number {
  if (!scope) return 0;
  return (scope.origins?.length ? 1 : 0) + (scope.establishmentTypes?.length ? 2 : 0);
}

function timeOf(value: string | Date | null | undefined): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function establishmentLabel(context: FormCaseContext): string {
  return (context.establishmentType || context.institutionActivity || '').trim();
}

export function describeCaseContext(context: FormCaseContext): string {
  const origin = context.origin?.trim().replace(/_/g, ' ') || 'every case type';
  const establishment = establishmentLabel(context);
  return establishment ? `${origin} · ${establishment}` : origin;
}

export function scopeMatches(scope: FormApplicability | null, context: FormCaseContext): boolean {
  if (!scope) return true;
  const origins = scope.origins ?? [];
  if (origins.length > 0 && (!context.origin || !origins.includes(context.origin))) return false;
  const types = (scope.establishmentTypes ?? []).map((item) => item.trim().toLowerCase());
  if (types.length === 0) return true;
  const actual = establishmentLabel(context).toLowerCase();
  if (!actual) return false;
  return types.some((type) => actual === type || actual.includes(type) || type.includes(actual));
}

export function chooseApplicableTemplate<T extends { appliesTo?: unknown; createAt?: string | Date | null }>(
  templates: T[],
  context: FormCaseContext,
): T | null {
  const matching = templates
    .map((template) => {
      const scope = parseApplicability(template.appliesTo);
      return { template, scope, specificity: specificity(scope), created: timeOf(template.createAt) };
    })
    .filter((item) => scopeMatches(item.scope, context));
  matching.sort((a, b) => b.specificity - a.specificity || b.created - a.created);
  return matching[0]?.template ?? null;
}

function byId<T>(items: T[] | undefined, idKey: keyof T): T[] {
  return [...(items ?? [])].sort((a, b) => Number(a[idKey] ?? 0) - Number(b[idKey] ?? 0));
}

function readAnswers(answers: Array<{ key?: string; value?: string }> | null | undefined): Map<string, string> {
  const byKey = new Map<string, string>();
  for (const answer of answers ?? []) {
    if (!answer?.key || !answer.value || !ASK_VALUES.has(answer.value)) continue;
    byKey.set(answer.key, answer.value);
  }
  return byKey;
}

function pushAsk(
  questions: RequiredQuestion[],
  ask: TemplateAskNode | undefined,
  askType: RequiredQuestion['askType'],
  askId: number | undefined,
  chapter: { h1Id: number; name: string; codePrefix: string },
  sectionName: string,
) {
  if (!ask || ask.active === false || askId == null) return;
  const index = questions.length + 1;
  questions.push({
    key: `${askType}_ask:${askId}`,
    txt: ask.name ?? '',
    h1Id: chapter.h1Id,
    chapterName: chapter.name,
    sectionName,
    codeLabel: `${chapter.codePrefix}.${index}`,
    askType,
    askId,
  });
}

export function assessFormCompleteness(
  template: TemplateTreeInput | null | undefined,
  answers: Array<{ key?: string; value?: string }> | null | undefined,
  context: FormCaseContext = {},
): FormCompleteness {
  const answeredByKey = readAnswers(answers);
  const chapters: ChapterCompleteness[] = [];
  const applicableKeys: string[] = [];

  byId(template?.h1s, 'h1Id').forEach((h1, h1Idx) => {
    const h1Id = Number(h1.h1Id ?? h1Idx + 1);
    const name = h1.name?.trim() || `Chapter ${h1Idx + 1}`;
    const codePrefix = String(h1Idx + 1);
    const chapterRef = { h1Id, name, codePrefix };
    const questions: RequiredQuestion[] = [];

    for (const ask of byId(h1.h1Asks, 'h1AskId')) {
      pushAsk(questions, ask, 'h1', ask.h1AskId, chapterRef, name);
    }
    for (const h2 of byId(h1.h2s, 'h2Id')) {
      const h2Name = h2.name?.trim() || name;
      for (const ask of byId(h2.h2Asks, 'h2AskId')) {
        pushAsk(questions, ask, 'h2', ask.h2AskId, chapterRef, h2Name);
      }
      for (const h3 of byId(h2.h3s, 'h3Id')) {
        const h3Name = h3.name?.trim() || h2Name;
        for (const ask of byId(h3.h3Asks, 'h3AskId')) {
          pushAsk(questions, ask, 'h3', ask.h3AskId, chapterRef, `${h2Name} / ${h3Name}`);
        }
        for (const h4 of byId(h3.h4s, 'h4Id')) {
          const h4Name = h4.name?.trim() || h3Name;
          for (const ask of byId(h4.h4Asks, 'h4AskId')) {
            pushAsk(questions, ask, 'h4', ask.h4AskId, chapterRef, `${h2Name} / ${h4Name}`);
          }
        }
      }
    }

    const inScope = scopeMatches(parseApplicability(h1.appliesTo), context);
    if (!inScope || questions.length === 0) {
      chapters.push({
        h1Id,
        name,
        codePrefix,
        status: 'not_applicable',
        answered: 0,
        required: 0,
        skipReason: inScope ? 'no_active_questions' : 'outside_case_scope',
        questions: [],
      });
      return;
    }

    let answered = 0;
    let exemptAnswers = 0;
    for (const question of questions) {
      applicableKeys.push(question.key);
      const value = answeredByKey.get(question.key);
      if (!value) continue;
      answered += 1;
      if (value === 'N/A') exemptAnswers += 1;
    }

    let status: ChapterStatus = 'incomplete';
    if (answered === questions.length && exemptAnswers === questions.length) status = 'exempt';
    else if (answered === questions.length) status = 'complete';

    chapters.push({
      h1Id,
      name,
      codePrefix,
      status,
      answered,
      required: questions.length,
      skipReason: null,
      questions,
    });
  });

  const requiredChapters = chapters.filter((chapter) => chapter.status !== 'not_applicable');
  const requiredQuestions = requiredChapters.reduce((sum, chapter) => sum + chapter.required, 0);
  const answeredQuestions = requiredChapters.reduce((sum, chapter) => sum + chapter.answered, 0);
  const incomplete = requiredChapters.filter((chapter) => chapter.status === 'incomplete');
  const scorableAnswers = requiredChapters.reduce((sum, chapter) => {
    return sum + chapter.questions.filter((question) => {
      const value = answeredByKey.get(question.key);
      return value === 'C' || value === 'CP' || value === 'NC';
    }).length;
  }, 0);
  const percent = requiredQuestions === 0 ? 0 : Math.round((answeredQuestions / requiredQuestions) * 100);
  const caseLabel = describeCaseContext(context);

  let blockReason: string | null = null;
  if (!template) {
    blockReason = 'The official evaluation form for this case is still loading.';
  } else if (requiredQuestions === 0) {
    blockReason = `No applicable criteria are configured for ${caseLabel}. Risk cannot be calculated until the form assigned to this request type includes required questions.`;
  } else if (incomplete.length > 0) {
    const pending = incomplete.map((chapter) => `${chapter.name} (${chapter.answered}/${chapter.required})`).join(', ');
    blockReason = `Submission is blocked until every required chapter is complete. Still open: ${pending}.`;
  } else if (scorableAnswers === 0) {
    blockReason = 'Every required criterion is marked N/A, so risk cannot be calculated. Score at least one applicable criterion as Complies, Partial, or Does Not Comply.';
  }

  return {
    templateId: template?.formTemplateId ?? null,
    templateName: template?.name ?? null,
    caseLabel,
    requiredQuestions,
    answeredQuestions,
    percent,
    chapters,
    applicableKeys,
    canSubmit: blockReason === null,
    blockReason,
  };
}
