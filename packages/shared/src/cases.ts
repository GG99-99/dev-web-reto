/**
 * cases.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Casos / Expedientes (RF-06, RF-19).
 * Un `Case` se origina desde una `BpmRequest`, una programación
 * institucional directa, una `LapchAlert` o una `Complaint` (campo `origin`).
 *
 * Endpoints: /cases, /cases/:id, /cases/:id/priority, /cases/:id/close,
 * /cases/:id/close/pdf
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';

/**
 * Modelo plano de `Case`, generado por Prisma. Se usa como building block en
 * respuestas de otros módulos (dashboard, bpm-requests, history, etc.).
 */
export type Case = Prisma.CaseGetPayload<{}>;

/**
 * Detalle completo de un caso, con todas sus relaciones (institución,
 * coordinador y técnico asignados, origen, evaluaciones, asignaciones y
 * adjuntos). Respuesta de `GET /cases/:id`.
 */
export type CaseDetail = Prisma.CaseGetPayload<{
  include: {
    institution: true;
    coordinator: { include: { person: true } };
    technician: { include: { person: true } };
    bpmRequest: true;
    lapchAlert: true;
    complaint: true;
    evaluations: true;
    assignments: true;
    attachments: true;
  };
}>;

/**
 * Body de `POST /cases`. Origina un caso por **programación institucional**
 * directa (`origin = 'PROGRAMACION_INSTITUCIONAL'`), sin pasar por una
 * `BpmRequest`, `LapchAlert` o `Complaint` previa.
 *
 * @example
 * ```ts
 * const body: CreateInstitutionalCaseRequest = {
 *   institutionId: 7,
 *   priority: 'MEDIA',
 *   motivo: 'Inspección de rutina anual',
 * };
 * ```
 */
export interface CreateInstitutionalCaseRequest {
  institutionId: number;
  priority: 'BAJA' | 'MEDIA' | 'ALTA';
  /** Se usa además para crear el `Evaluation.reason` inicial del caso. */
  motivo: string;
}

/**
 * Body de `POST /cases/:id/close` (RF-19: cierre de expediente).
 *
 * @example
 * ```ts
 * const body: CloseCaseRequest = {
 *   resultadoFinal: 'Cumple con los requisitos de BPM',
 *   emitirInforme: true,
 * };
 * ```
 */
export interface CloseCaseRequest {
  resultadoFinal: string;
  /** Si es `true`, el backend genera y adjunta el PDF oficial del cierre. */
  emitirInforme: boolean;
}

/**
 * Respuesta de `POST /cases/:id/close`.
 * El caso resultante queda con `status = 'CERRADO'` y `closedAt` seteado.
 */
export interface CloseCaseResponse {
  case: CaseDetail;
  /** Presente solo si `emitirInforme` fue `true` en el request. */
  informeOficialUrl?: string;
}
