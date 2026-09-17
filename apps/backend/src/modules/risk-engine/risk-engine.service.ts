import type { AskAnswer } from '@reto/shared';
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
 * partir de las respuestas C/CP/IT/N/A/NC del formulario. Se implementó un
 * algoritmo simple y transparente para no bloquear el flujo end-to-end:
 *
 *   - Se ignoran las respuestas "N/A" (no aplican al cálculo).
 *   - Peso de riesgo por respuesta: C=0, CP=1, IT=2, NC=3.
 *   - puntajeObtenido = (Σ pesos / cantidad de respuestas aplicables) * (10/3)
 *     -> normaliza a una escala 0–10 (todas NC = 10, todas C = 0), consistente
 *        con el orden de magnitud de los ejemplos del schema.
 *   - porcentajeCumplimiento = (cantidad de "C" / respuestas aplicables) * 100
 *
 * TODO: reemplazar por la fórmula oficial cuando esté disponible, y
 * ajustar/seedear `RiskFrequencyRule` con los umbrales reales.
 * ---------------------------------------------------------------------------
 */

const RISK_WEIGHT: Record<string, number> = { C: 0, CP: 1, IT: 2, NC: 3 };

export interface ComputedRisk {
  puntajeObtenido: number;
  porcentajeCumplimiento: number;
  nivelRiesgo: RiskLevel;
  frecuenciaInspeccion: InspectionFrequency;
}

export const riskEngineService = {
  /** Calcula el riesgo a partir de las respuestas y lo persiste (upsert) para la evaluación. */
  computeAndPersist: async (evaluationId: number, answers: AskAnswer[]): Promise<ComputedRisk> => {
    const applicable = answers.filter((a) => a.value !== 'N/A');

    if (applicable.length === 0) {
      throw ApiError.validation('No hay respuestas aplicables (todas N/A) para calcular el riesgo');
    }

    const totalWeight = applicable.reduce((sum, a) => sum + (RISK_WEIGHT[a.value] ?? 0), 0);
    const puntajeObtenido = Number(((totalWeight / applicable.length) * (10 / 3)).toFixed(2));

    const compliant = applicable.filter((a) => a.value === 'C').length;
    const porcentajeCumplimiento = Number(((compliant / applicable.length) * 100).toFixed(2));

    const rule = await riskEngineModel.findMatchingRule(puntajeObtenido);
    if (!rule) {
      throw ApiError.internal(
        'No hay una RiskFrequencyRule que cubra el puntaje calculado; revisa el catálogo de reglas (GET /catalogs/risk-frequency-rules)',
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
    if (!score) throw ApiError.notFound('Esta evaluación todavía no tiene un puntaje calculado');
    return score;
  },

  getRules: async () => riskEngineModel.getRules(),

  updateRule: async (ruleId: number, data: { minScore?: number; maxScore?: number | null; riskLevel?: RiskLevel; frequency?: InspectionFrequency }) => {
    return riskEngineModel.updateRule(ruleId, data);
  },
};
