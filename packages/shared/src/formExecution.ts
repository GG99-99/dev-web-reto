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
 * - `C`: Cumple
 * - `CP`: Cumple Parcialmente
 * - `IT`: Iniciado Trabajo / En proceso (según definición de negocio)
 * - `N/A`: No Aplica
 * - `NC`: No Cumple
 */
export type AskValue = 'C' | 'CP' | 'IT' | 'N/A' | 'NC';

/**
 * Respuesta individual a una pregunta del árbol del formulario.
 *
 * @example
 * ```ts
 * const answer: AskAnswer = {
 *   askId: 'h3_ask:123',
 *   value: 'NC',
 *   observaciones: 'No se encontró registro de temperatura del refrigerador',
 * };
 * ```
 */
export interface AskAnswer {
  /** Identificador compuesto de la pregunta, ej. `"h3_ask:123"`. */
  askId: string;
  value: AskValue;
  observaciones?: string;
  comentarios?: string;
}

/**
 * Estructura del JSON `FormResponse.answers` tal como se guarda/consume en
 * el frontend. Body de `PATCH /evaluations/:id/answers` (upsert parcial).
 *
 * @example
 * ```ts
 * const payload: FormAnswersPayload = { answers: [answer1, answer2] };
 * await api.patch(`/evaluations/${id}/answers`, payload);
 * ```
 */
export interface FormAnswersPayload {
  answers: AskAnswer[];
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
