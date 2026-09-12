/**
 * lapchAlerts.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Alertas LAPCH (RF-08).
 * Endpoints: /lapch-alerts, /lapch-alerts/:id, /lapch-alerts/:id/resultado,
 * /lapch-alerts/:id/generate-case, /lapch-alerts/:id/close
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';
import type { Case } from './cases';

/** Modelo plano de `LapchAlert`, generado por Prisma. */
export type LapchAlert = Prisma.LapchAlertGetPayload<{}>;

/**
 * Body de `POST /lapch-alerts` (registrar una nueva alerta de laboratorio).
 *
 * @example
 * ```ts
 * const body: CreateLapchAlertRequest = {
 *   institutionId: 7,
 *   numeroAlerta: 'LAPCH-2026-0451',
 *   fecha: '2026-09-10',
 *   producto: 'Queso fresco',
 *   descripcion: 'Presencia de Listeria monocytogenes',
 * };
 * ```
 */
export type CreateLapchAlertRequest = Pick<
  Prisma.LapchAlertCreateInput,
  'numeroAlerta' | 'fecha' | 'producto' | 'descripcion'
> & { institutionId: number };

/**
 * Body de `PATCH /lapch-alerts/:id/resultado`.
 * Solo si `resultado === 'PROCEDE'` se habilita `POST .../generate-case`.
 */
export interface SetLapchResultRequest {
  resultado: 'PROCEDE' | 'NO_PROCEDE';
}

/**
 * Respuesta de `POST /lapch-alerts/:id/generate-case`.
 * El caso generado tendrá `origin = 'ALERTA_LAPCH'`.
 */
export interface GenerateCaseFromAlertResponse {
  case: Case;
}
