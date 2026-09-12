/**
 * history.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Consulta Histórica (RF-20).
 * Endpoint de búsqueda transversal; no es un recurso propio, sino un
 * agregador de lectura sobre Case | Evaluation | BpmRequest.
 *
 * Endpoints: /history/search
 * ---------------------------------------------------------------------------
 */
import type { PaginationQuery, PaginatedResponse } from './common';
import type { Institution } from './institutions';
import type { EvaluationScore } from './riskEngine';
import type { EvaluationReport } from './reports';

/**
 * Query de `GET /history/search`.
 * Acceso: COORDINADOR, ADMIN, ADMIN_EMPRESA (limitado a su propia empresa).
 *
 * @example
 * ```ts
 * const query: HistorySearchQuery = {
 *   institutionId: 7,
 *   entityType: 'EVALUATION',
 *   fechaDesde: '2026-01-01',
 *   fechaHasta: '2026-09-01',
 *   page: 1,
 *   pageSize: 20,
 * };
 * ```
 */
export interface HistorySearchQuery extends PaginationQuery {
  institutionId?: number;
  bpmRequestId?: number;
  evaluationId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  /** Status de `Case` | `Evaluation` | `BpmRequest`, según `entityType`. */
  status?: string;
  entityType?: 'CASE' | 'EVALUATION' | 'BPM_REQUEST';
}

/**
 * Item devuelto por la búsqueda histórica. `score` y `reportSummary`
 * solo vienen presentes cuando `entityType === 'EVALUATION'`.
 */
export interface HistorySearchItem {
  entityType: 'CASE' | 'EVALUATION' | 'BPM_REQUEST';
  id: number;
  institution: Pick<Institution, 'institutionId' | 'name'>;
  status: string;
  createdAt: string;
  score?: EvaluationScore;
  reportSummary?: Pick<EvaluationReport, 'reportId' | 'status'>;
}

/** Respuesta paginada de `GET /history/search`. */
export type HistorySearchResponse = PaginatedResponse<HistorySearchItem>;
