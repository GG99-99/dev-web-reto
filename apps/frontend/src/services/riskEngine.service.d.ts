import type { ApiResponse, EvaluationScore, RiskFrequencyRule } from '@reto/shared';
/** `GET /evaluations/:id/score` — Con acceso a la evaluación. */
declare function getScore(evaluationId: number): Promise<ApiResponse<EvaluationScore>>;
/** `GET /catalogs/risk-frequency-rules` — ADMIN. Matriz de frecuencia de inspección. */
declare function listFrequencyRules(): Promise<ApiResponse<RiskFrequencyRule[]>>;
/**
 * `PATCH /catalogs/risk-frequency-rules/:id` — ADMIN. Ajusta umbrales de la matriz.
 *
 * @example
 * ```ts
 * await riskEngineService.updateFrequencyRule(ruleId, { frecuenciaMeses: 6 });
 * ```
 */
declare function updateFrequencyRule(id: number, body: Partial<RiskFrequencyRule>): Promise<ApiResponse<RiskFrequencyRule>>;
export declare const riskEngineService: {
    getScore: typeof getScore;
    listFrequencyRules: typeof listFrequencyRules;
    updateFrequencyRule: typeof updateFrequencyRule;
};
export {};
