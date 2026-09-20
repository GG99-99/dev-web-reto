import type { ApiResponse, FormTemplateTree, StartEvaluationRequest, FormAnswersPayload, EvaluationExecutionDetail, FinishEvaluationResponse } from '@reto/shared';
/**
 * `GET /form-templates` — ADMIN, COORDINADOR. Lista plantillas activas.
 *
 * @remarks
 * El contrato original solo tipa el árbol completo ({@link FormTemplateTree})
 * para el endpoint de detalle (`/form-templates/:id/tree`); se reutiliza
 * aquí para el listado. Si tu backend responde una versión aligerada (sin
 * incluir `h1s`), ajusta este tipo con un `Pick`/`Omit`.
 */
declare function listTemplates(): Promise<ApiResponse<FormTemplateTree[]>>;
/**
 * `GET /form-templates/:id/tree` — Todos los roles operativos.
 * Árbol completo `h1 → h2 → h3 → h4` con sus `*_ask`.
 */
declare function getTemplateTree(id: number): Promise<ApiResponse<FormTemplateTree>>;
/**
 * `POST /evaluations/:id/start` — TECNICO_EVALUADOR asignado.
 * `status → 'EN_PROCESO'`, crea un `FormResponse` vacío.
 */
declare function start(evaluationId: number, body: StartEvaluationRequest): Promise<ApiResponse<EvaluationExecutionDetail>>;
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
declare function saveAnswers(evaluationId: number, body: FormAnswersPayload): Promise<ApiResponse<EvaluationExecutionDetail>>;
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
declare function finish(evaluationId: number): Promise<ApiResponse<FinishEvaluationResponse>>;
export declare const formExecutionService: {
    listTemplates: typeof listTemplates;
    getTemplateTree: typeof getTemplateTree;
    start: typeof start;
    saveAnswers: typeof saveAnswers;
    finish: typeof finish;
};
export {};
