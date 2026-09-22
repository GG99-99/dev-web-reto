import type { FormAnswers, AskValue } from '@reto/shared';
import type { RiskLevel, InspectionFrequency } from '@reto/db';
import { riskEngineModel } from './risk-engine.model';
import { ApiError } from '@/lib/common/ApiError';

/**
 * risk-engine.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio de RF-14 (motor de riesgo). Sección 12 de
 * API_CONTRACTS.md.
 *
 * ⚠️ ASUNCIÓN DE NEGOCIO (documentar/validar con la Matriz_Riesgo_Alimentos
 * real, que no está disponible en este repo — solo se menciona en el schema
 * de Prisma como referencia): el contrato define el *rango de salida*
 * (RiskFrequencyRule: minScore/maxScore -> nivel/frecuencia, con el ejemplo
 * "1.0-3.6 Bajo/Anual, 3.6-6.3 Medio/Semestral, >6.3 Alto/Trimestral") pero
 * NO define cómo se calculan `puntajeObtenido` ni `porcentajeCumplimiento` a
 * partir de las respuestas C/CP/NC/N-A del formulario. Se implementó un
 * algoritmo simple y transparente para no bloquear el flujo end-to-end:
 *
 *   - Se ignoran las respuestas "N/A" (no aplican al cálculo).
 *   - Cada código se traduce a un grado de cumplimiento 0–1 (COMPLIANCE):
 *     C=1 (cumple total), CP=0.5 (cumple parcial), NC=0 (no cumple).
 *   - cumplimientoPromedio = Σ grado / cantidad de respuestas aplicables (0..1)
 *   - porcentajeCumplimiento = cumplimientoPromedio * 100
 *   - puntajeObtenido = (1 - cumplimientoPromedio) * 10
 *     -> normaliza a una escala 0–10 de RIESGO (todas NC = 10, todas C = 0),
 *        consistente con el orden de magnitud de los ejemplos del schema.
 *
 * TODO: reemplazar por la fórmula oficial cuando esté disponible, y
 * ajustar/seedear `RiskFrequencyRule` con los umbrales reales.
 * ---------------------------------------------------------------------------
 */

const COMPLIANCE: Record<Exclude<AskValue, 'N/A'>, number> = { C: 1, CP: 0.5, NC: 0 };

export interface ComputedRisk {
  puntajeObtenido: number;
  porcentajeCumplimiento: number;
  nivelRiesgo: RiskLevel;
  frecuenciaInspeccion: InspectionFrequency;
}

export const riskEngineService = {
  /** Calcula el riesgo a partir de las respuestas y lo persiste (upsert) para la evaluación. */
  computeAndPersist: async (evaluationId: number, answers: FormAnswers): Promise<ComputedRisk> => {
    const applicable = answers.filter((a) => a.value !== 'N/A');

    if (applicable.length === 0) {
      throw ApiError.validation('No applicable answers (all N/A); risk cannot be calculated');
    }

    const cumplimientoPromedio =
      applicable.reduce((sum, a) => sum + COMPLIANCE[a.value as Exclude<AskValue, 'N/A'>], 0) / applicable.length;

    const porcentajeCumplimiento = Number((cumplimientoPromedio * 100).toFixed(2));
    const puntajeObtenido = Number(((1 - cumplimientoPromedio) * 10).toFixed(2));

    const rule = await riskEngineModel.findMatchingRule(puntajeObtenido);
    if (!rule) {
      throw ApiError.internal(
        'No RiskFrequencyRule found covering the calculated score; check the rules catalog (GET /catalogs/risk-frequency-rules)',
      );
    }

    await riskEngineModel.upsertScore(evaluationId, {
      puntajeObtenido,
      porcentajeCumplimiento,
      nivelRiesgo: rule.riskLevel,
      frecuenciaInspeccion: rule.frequency,
    });

    return {
      puntajeObtenido,
      porcentajeCumplimiento,
      nivelRiesgo: rule.riskLevel,
      frecuenciaInspeccion: rule.frequency,
    };
  },

  getByEvaluation: async (evaluationId: number) => {
    const score = await riskEngineModel.getScoreByEvaluation(evaluationId);
    if (!score) throw ApiError.notFound('This evaluation does not yet have a calculated score');
    return score;
  },

  getRules: async () => riskEngineModel.getRules(),

  updateRule: async (ruleId: number, data: { minScore?: number; maxScore?: number | null; riskLevel?: RiskLevel; frequency?: InspectionFrequency }) => {
    return riskEngineModel.updateRule(ruleId, data);
  },
};
