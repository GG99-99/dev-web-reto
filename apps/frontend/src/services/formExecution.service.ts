/**
 * formExecution.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Ejecución de Evaluación (RF-12) y
 * Formulario EBR (RF-13).
 * Ver API_CONTRACTS.md, sección 11.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  FormTemplateTree,
  StartEvaluationRequest,
  FormAnswersPayload,
  EvaluationExecutionDetail,
  FinishEvaluationResponse,
} from '@reto/shared';

/**
 * `GET /form-templates` — ADMIN, COORDINADOR. Lista plantillas activas.
 *
 * @remarks
 * El contrato original solo tipa el árbol completo ({@link FormTemplateTree})
 * para el endpoint de detalle (`/form-templates/:id/tree`); se reutiliza
 * aquí para el listado. Si tu backend responde una versión aligerada (sin
 * incluir `h1s`), ajusta este tipo con un `Pick`/`Omit`.
 */
async function listTemplates(): Promise<ApiResponse<FormTemplateTree[]>> {
  const { data } = await httpClient.get<ApiResponse<FormTemplateTree[]>>('/form-templates');
  return data;
}

/**
 * `GET /form-templates/:id/tree` — Todos los roles operativos.
 * Árbol completo `h1 → h2 → h3 → h4` con sus `*_ask`.
 */
async function getTemplateTree(id: number): Promise<ApiResponse<FormTemplateTree>> {
  const { data } = await httpClient.get<ApiResponse<FormTemplateTree>>(
    `/form-templates/${id}/tree`,
  );
  return data;
}

/**
 * `POST /evaluations/:id/start` — TECNICO_EVALUADOR asignado.
 * `status → 'EN_PROCESO'`, crea un `FormResponse` vacío.
 */
async function start(
  evaluationId: number,
  body: StartEvaluationRequest,
): Promise<ApiResponse<EvaluationExecutionDetail>> {
  const { data } = await httpClient.post<ApiResponse<EvaluationExecutionDetail>>(
    `/evaluations/${evaluationId}/start`,
    body,
  );
  return data;
}

/**
 * `PATCH /evaluations/:id/answers` — TECNICO_EVALUADOR asignado.
 * Guarda avance del formulario (upsert parcial del JSON `answers`).
 *
 * @remarks
 * RF-17: el backend rechaza (`403`) este endpoint si el `EvaluationReport`
 * asociado ya tiene `locked = true`.
 *
 * @example
 * ```ts
 * await formExecutionService.saveAnswers(evaluationId, {
 *   answers: [{ askId: 'h3_ask:123', value: 'NC', observaciones: 'Sin registro de temperatura' }],
 * });
 * ```
 */
async function saveAnswers(
  evaluationId: number,
  body: FormAnswersPayload,
): Promise<ApiResponse<EvaluationExecutionDetail>> {
  const { data } = await httpClient.patch<ApiResponse<EvaluationExecutionDetail>>(
    `/evaluations/${evaluationId}/answers`,
    body,
  );
  return data;
}

/**
 * `POST /evaluations/:id/finish` — TECNICO_EVALUADOR asignado.
 * Finaliza la evaluación, dispara el motor de riesgo (RF-14) y genera el
 * informe (RF-16).
 *
 * @example
 * ```ts
 * const res = await formExecutionService.finish(evaluationId);
 * if (res.valid) console.log(res.data.score.nivelRiesgo, res.data.report.status);
 * ```
 */
async function finish(evaluationId: number): Promise<ApiResponse<FinishEvaluationResponse>> {
  const { data } = await httpClient.post<ApiResponse<FinishEvaluationResponse>>(
    `/evaluations/${evaluationId}/finish`,
  );
  return data;
}

export const formExecutionService = {
  listTemplates,
  getTemplateTree,
  start,
  saveAnswers,
  finish,
};
