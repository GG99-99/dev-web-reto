import type { ApiResponse, Evidence, CreateEvidenceRequest } from '@reto/shared';
/** `GET /evaluations/:id/evidences` — Con acceso. Lista de evidencias. */
declare function listByEvaluation(evaluationId: number): Promise<ApiResponse<Evidence[]>>;
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
declare function upload(evaluationId: number, body: CreateEvidenceRequest): Promise<ApiResponse<Evidence>>;
/**
 * `DELETE /evidences/:id` — TECNICO_EVALUADOR asignado, antes de finalizar la evaluación.
 */
declare function remove(id: number): Promise<ApiResponse<{
    id: number;
}>>;
export declare const evidencesService: {
    listByEvaluation: typeof listByEvaluation;
    upload: typeof upload;
    remove: typeof remove;
};
export {};
