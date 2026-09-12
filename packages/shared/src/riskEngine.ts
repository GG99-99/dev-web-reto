/**
 * riskEngine.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Motor de Riesgo (RF-14).
 * Cálculo automático; no expone escritura directa, solo lectura y el
 * catálogo de reglas.
 *
 * Endpoints: /evaluations/:id/score, /catalogs/risk-frequency-rules,
 * /catalogs/risk-frequency-rules/:id
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';

/**
 * Resultado del cálculo de riesgo de una evaluación: puntaje, porcentaje de
 * cumplimiento y nivel de riesgo. Respuesta de `GET /evaluations/:id/score`.
 */
export type EvaluationScore = Prisma.EvaluationScoreGetPayload<{}>;

/**
 * Regla de la matriz de frecuencia de inspección. Editable únicamente por
 * ADMIN vía `PATCH /catalogs/risk-frequency-rules/:id`.
 */
export type RiskFrequencyRule = Prisma.RiskFrequencyRuleGetPayload<{}>;
