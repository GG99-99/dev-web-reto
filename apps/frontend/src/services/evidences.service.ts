/**
 * evidences.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Captura de Evidencias (RF-15).
 * Ver API_CONTRACTS.md, sección 13.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type { ApiResponse, Evidence, CreateEvidenceRequest } from '@reto/shared';

/** `GET /evaluations/:id/evidences` — Con acceso. Lista de evidencias. */
async function listByEvaluation(evaluationId: number): Promise<ApiResponse<Evidence[]>> {
  const { data } = await httpClient.get<ApiResponse<Evidence[]>>(
    `/evaluations/${evaluationId}/evidences`,
  );
  return data;
}

/**
 * `POST /evaluations/:id/evidences` — TECNICO_EVALUADOR asignado.
 * Sube foto/video/documento (`multipart/form-data`).
 *
 * @example
 * ```ts
 * await evidencesService.upload(evaluationId, {
 *   file: fileInput.files[0],
 *   type: 'FOTO',
 *   h3AskId: 123,
 *   latitude: 18.4861,
 *   longitude: -69.9312,
 * });
 * ```
 */
async function upload(
  evaluationId: number,
  body: CreateEvidenceRequest,
): Promise<ApiResponse<Evidence>> {
  const form = new FormData();
  form.append('file', body.file);
  form.append('type', body.type);
  if (body.comment !== undefined) form.append('comment', body.comment);
  if (body.latitude !== undefined) form.append('latitude', String(body.latitude));
  if (body.longitude !== undefined) form.append('longitude', String(body.longitude));
  if (body.h1AskId !== undefined) form.append('h1AskId', String(body.h1AskId));
  if (body.h2AskId !== undefined) form.append('h2AskId', String(body.h2AskId));
  if (body.h3AskId !== undefined) form.append('h3AskId', String(body.h3AskId));
  if (body.h4AskId !== undefined) form.append('h4AskId', String(body.h4AskId));

  const { data } = await httpClient.post<ApiResponse<Evidence>>(
    `/evaluations/${evaluationId}/evidences`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

/**
 * `DELETE /evidences/:id` — TECNICO_EVALUADOR asignado, antes de finalizar la evaluación.
 */
async function remove(id: number): Promise<ApiResponse<{ id: number }>> {
  const { data } = await httpClient.delete<ApiResponse<{ id: number }>>(`/evidences/${id}`);
  return data;
}

export const evidencesService = {
  listByEvaluation,
  upload,
  remove,
};
