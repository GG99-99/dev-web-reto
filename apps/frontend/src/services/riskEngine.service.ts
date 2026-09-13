/**
 * riskEngine.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Motor de Riesgo (RF-14).
 * Cálculo automático; solo lectura + catálogo de reglas editable por ADMIN.
 * Ver API_CONTRACTS.md, sección 12.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type { ApiResponse, EvaluationScore, RiskFrequencyRule } from '@reto/shared';

/** `GET /evaluations/:id/score` — Con acceso a la evaluación. */
async function getScore(evaluationId: number): Promise<ApiResponse<EvaluationScore>> {
  const { data } = await httpClient.get<ApiResponse<EvaluationScore>>(
    `/evaluations/${evaluationId}/score`,
  );
  return data;
}

/** `GET /catalogs/risk-frequency-rules` — ADMIN. Matriz de frecuencia de inspección. */
async function listFrequencyRules(): Promise<ApiResponse<RiskFrequencyRule[]>> {
  const { data } = await httpClient.get<ApiResponse<RiskFrequencyRule[]>>(
    '/catalogs/risk-frequency-rules',
  );
  return data;
}

/**
 * `PATCH /catalogs/risk-frequency-rules/:id` — ADMIN. Ajusta umbrales de la matriz.
 *
 * @example
 * ```ts
 * await riskEngineService.updateFrequencyRule(ruleId, { frecuenciaMeses: 6 });
 * ```
 */
async function updateFrequencyRule(
  id: number,
  body: Partial<RiskFrequencyRule>,
): Promise<ApiResponse<RiskFrequencyRule>> {
  const { data } = await httpClient.patch<ApiResponse<RiskFrequencyRule>>(
    `/catalogs/risk-frequency-rules/${id}`,
    body,
  );
  return data;
}

export const riskEngineService = {
  getScore,
  listFrequencyRules,
  updateFrequencyRule,
};
