/**
 * evidences.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Captura de Evidencias (RF-15).
 * Endpoints: /evaluations/:id/evidences, /evidences/:id
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db'

/** Modelo plano de `Evidence`, generado por Prisma. */
export type Evidence = Prisma.EvidenceGetPayload<{}>;

/**
 * Body de `POST /evaluations/:id/evidences`. Se envía como
 * `multipart/form-data` (contiene un archivo binario).
 *
 * @remarks
 * Solo el `TECNICO_EVALUADOR` asignado a la evaluación puede subir
 * evidencias, y solo antes de finalizarla.
 *
 * @example
 * ```ts
 * const form = new FormData();
 * form.append('file', fileInput.files[0]);
 * form.append('type', 'FOTO' satisfies CreateEvidenceRequest['type']);
 * form.append('h3AskId', '123');
 * await fetch(`/api/v1/evaluations/${evalId}/evidences`, { method: 'POST', body: form });
 * ```
 */
export interface CreateEvidenceRequest {
  /** Archivo binario (foto, video o documento). */
  file: File;
  type: 'FOTO' | 'VIDEO' | 'DOCUMENTO';
  comment?: string;
  /** Geolocalización opcional de captura. */
  latitude?: number;
  longitude?: number;
  /** Ids opcionales para asociar la evidencia a una pregunta específica del árbol EBR. */
  h1AskId?: number;
  h2AskId?: number;
  h3AskId?: number;
  h4AskId?: number;
}
