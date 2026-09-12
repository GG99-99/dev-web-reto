/**
 * bpmRequests.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Solicitudes BPM (RF-05).
 * Endpoints: /bpm-requests, /bpm-requests/:id, /bpm-requests/:id/attachments,
 * /bpm-requests/:id/submit
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';
import type { Case } from './cases';

/**
 * Item de listado de solicitudes BPM, con datos mínimos de la institución
 * para render de tablas (`GET /bpm-requests`).
 */
export type BpmRequestListItem = Prisma.BpmRequestGetPayload<{
  include: { institution: { select: { institutionId: true; name: true } } };
}>;

/** Detalle completo de una solicitud BPM (`GET /bpm-requests/:id`). */
export type BpmRequestDetail = Prisma.BpmRequestGetPayload<{
  include: { institution: true; attachments: true; case: true };
}>;

/**
 * Body de `POST /bpm-requests`. Se crea con `status = 'BORRADOR'`.
 *
 * @example
 * ```ts
 * const body: CreateBpmRequestRequest = {
 *   institutionId: 7,
 *   tipoEstablecimiento: 'Planta procesadora',
 *   motivo: 'Renovación de permiso sanitario',
 * };
 * ```
 */
export type CreateBpmRequestRequest = Pick<
  Prisma.BpmRequestCreateInput,
  'tipoEstablecimiento' | 'motivo' | 'observaciones'
> & { institutionId: number };

/**
 * Body de `PATCH /bpm-requests/:id`. Solo el autor puede editar y solo
 * mientras la solicitud esté en estado `BORRADOR`.
 */
export type UpdateBpmRequestRequest = Partial<CreateBpmRequestRequest>;

/**
 * Respuesta de `POST /bpm-requests/:id/submit`.
 * Al enviar, la solicitud pasa de `BORRADOR` a `PENDIENTE_ASIGNACION` y se
 * genera automáticamente un `Case` con `origin = 'SOLICITUD_EMPRESA'`.
 *
 * @example
 * ```ts
 * const { data } = await submitBpmRequest(id) as ApiSuccessResponse<SubmitBpmRequestResponse>;
 * navigateTo(`/cases/${data.case.caseId}`);
 * ```
 */
export interface SubmitBpmRequestResponse {
  bpmRequest: BpmRequestDetail;
  /** Caso creado automáticamente al enviar la solicitud. */
  case: Case;
}
