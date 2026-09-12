/**
 * complaints.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Denuncias (RF-09).
 * Endpoints: /complaints, /complaints/:id, /complaints/:id/resultado,
 * /complaints/:id/generate-case
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';

/** Modelo plano de `Complaint`, generado por Prisma. */
export type Complaint = Prisma.ComplaintGetPayload<{}>;

/**
 * Body de `POST /complaints`. Endpoint accesible también de forma
 * **pública** (formulario de denuncia ciudadana), además de por
 * COORDINADOR/ADMIN.
 *
 * @example
 * ```ts
 * const body: CreateComplaintRequest = {
 *   tipoDenuncia: 'Condiciones sanitarias',
 *   fechaRecepcion: '2026-09-12',
 *   denunciante: 'Anónimo',
 *   descripcion: 'Manejo inadecuado de alimentos en el establecimiento',
 *   institutionId: 7,
 * };
 * ```
 */
export type CreateComplaintRequest = Pick<
  Prisma.ComplaintCreateInput,
  'tipoDenuncia' | 'fechaRecepcion' | 'denunciante' | 'descripcion'
> & { institutionId?: number };

/**
 * Body de `PATCH /complaints/:id/resultado`.
 * Cuando el resultado es `PROCEDE`, se habilita
 * `POST /complaints/:id/generate-case` (crea `Case` con `origin = 'DENUNCIA'`).
 */
export interface SetComplaintResultRequest {
  resultado: 'PROCEDE' | 'NO_PROCEDE' | 'REMISION_OTRO_PROCESO';
}
