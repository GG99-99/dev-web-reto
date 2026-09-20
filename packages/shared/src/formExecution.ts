/**
 * formExecution.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Ejecución de Evaluación (RF-12) y Formulario EBR (RF-13).
 *
 * 11.1 Plantillas / árbol de preguntas (solo lectura para el técnico)
 *   Endpoints: /form-templates, /form-templates/:id/tree
 *
 * 11.2 Ejecución en campo
 *   Endpoints: /evaluations/:id/start, /evaluations/:id/answers,
 *   /evaluations/:id/finish
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';
import type { EvaluationScore } from './riskEngine';
import type { EvaluationReportDetail } from './reports';

/**
 * Árbol completo de una plantilla de formulario: `h1 → h2 → h3 → h4`, cada
 * nivel con sus preguntas (`*Asks`) asociadas. Respuesta de
 * `GET /form-templates/:id/tree`.
 *
 * @remarks
 * Es un árbol de 4 niveles de profundidad; se recomienda memoizar/normalizar
 * en el frontend antes de renderizar formularios largos.
 */
export type FormTemplateTree = Prisma.FormTemplateGetPayload<{
  include: {
    h1s: {
      include: {
        h1Asks: true;
        h2s: {
          include: {
            h2Asks: true;
            h3s: { include: { h3Asks: true; h4s: { include: { h4Asks: true } } } };
          };
        };
      };
    };
  };
}>;

/**
 * Valores posibles de respuesta a una pregunta (`ask`) del formulario EBR.
 * - `C`   : Cumple (cumplimiento total)
 * - `CP`  : Cumple Parcialmente
 * - `NC`  : No Cumple
 * - `N/A` : No Aplica (se excluye del cálculo de riesgo, ver risk-engine.service.ts)
 */
export type AskValue = 'C' | 'CP' | 'NC' | 'N/A';

/**
 * Required to initialize a `FormResponse` for an evaluation. The current
 * backend requires these existing establishment records before an assessor
 * can start field work.
 */
export interface StartEvaluationRequest {
  representId: number;
  foodId: number;
}

/**
 * Respuesta individual a una pregunta del árbol del formulario.
 *
 * @example
 * ```ts
 * const answer: AskAnswer = {
 *   key: 'h3_ask:123',
 *   txt: 'Las paredes son lisas, impermeables y de color claro',
 *   value: 'NC',
 * };
 * ```
 */
export interface AskAnswer {
  /** Identificador compuesto de la pregunta, ej. `"h3_ask:123"`. Sirve como clave estable para el upsert parcial. */
  key: string;
  /** Texto exacto de la pregunta, tal como aparece en el árbol de `GET /form-templates/:id/tree`. */
  txt: string;
  value: AskValue;
}

/** Lista de respuestas de una ficha diligenciada. Así se guarda `FormResponse.answers`. */
export type FormAnswers = AskAnswer[];

/**
 * Estructura del JSON `FormResponse.answers` tal como se guarda/consume en
 * el frontend. Body de `PATCH /evaluations/:id/answers` (upsert parcial:
 * solo hace falta enviar las preguntas que cambiaron).
 *
 * @example
 * ```ts
 * const payload: FormAnswersPayload = {
 *   answers: [
 *     { key: 'h3_ask:123', txt: 'Las paredes son lisas, impermeables y de color claro', value: 'C' },
 *   ],
 * };
 * await api.patch(`/evaluations/${id}/answers`, payload);
 * ```
 */
export interface FormAnswersPayload {
  answers: FormAnswers;
}

/**
 * Detalle de una evaluación durante/al finalizar su ejecución en campo,
 * con el `FormResponse` y las `Evidence` asociadas incluidas.
 */
export type EvaluationExecutionDetail = Prisma.EvaluationGetPayload<{
  include: { formResponse: true; evidences: true };
}>;

/**
 * Respuesta de `POST /evaluations/:id/finish`.
 * Al finalizar, la evaluación pasa a `status = 'FINALIZADA'`, se dispara el
 * motor de riesgo (RF-14) y se autogenera el informe (RF-16).
 *
 * @example
 * ```ts
 * const { data } = await finishEvaluation(id) as ApiSuccessResponse<FinishEvaluationResponse>;
 * console.log(data.score.nivelRiesgo, data.report.status);
 * ```
 */
export interface FinishEvaluationResponse {
  evaluation: EvaluationExecutionDetail;
  score: EvaluationScore;
  report: EvaluationReportDetail;
}
