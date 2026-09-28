/**
 * Single display status for a BPM request as the company should see it.
 * Stored enums stay on their own tables. This value is derived from the
 * request, its case, the current evaluation, and the report together.
 */
export type LifecycleStatus =
  | 'BORRADOR'
  | 'PENDIENTE_ASIGNACION'
  | 'ASIGNADO'
  | 'EN_PROCESO'
  | 'FINALIZADA'
  | 'ENVIADO'
  | 'EN_REVISION'
  | 'EN_CORRECCION'
  | 'APROBADA'
  | 'CERRADO'
  | 'RECHAZADA'
  | 'CANCELADA';

export interface LifecycleSnapshot {
  requestStatus?: string | null;
  caseStatus?: string | null;
  technicianId?: number | null;
  evaluationStatus?: string | null;
  reportStatus?: string | null;
}

export interface LifecycleEvaluation {
  status?: string | null;
  createdAt?: Date | string | null;
  report?: { status?: string | null } | null;
}

/** Latest visit that is still part of the case. A cancelled visit does not hide an older active one. */
export function pickCurrentEvaluation<T extends LifecycleEvaluation>(evaluations?: T[] | null): T | undefined {
  if (!evaluations?.length) return undefined;
  const ranked = [...evaluations].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
  return ranked.find((item) => item.status !== 'CANCELADA') ?? ranked[0];
}

/**
 * Company-facing status. Later workflow facts win over an older request status,
 * so an approved or closed case is never shown as still pending assignment.
 */
export function deriveLifecycleStatus(input: LifecycleSnapshot): string {
  const requestStatus = input.requestStatus ?? '';
  const caseStatus = input.caseStatus ?? '';
  const evaluationStatus = input.evaluationStatus ?? '';
  const reportStatus = input.reportStatus ?? '';

  if (requestStatus === 'RECHAZADA') return 'RECHAZADA';
  if (requestStatus === 'BORRADOR' && !caseStatus) return 'BORRADOR';
  if (caseStatus === 'CERRADO') return 'CERRADO';
  if (reportStatus === 'APROBADO' || requestStatus === 'APROBADA') return 'APROBADA';
  if (reportStatus === 'EN_CORRECCION' || reportStatus === 'DEVUELTO' || evaluationStatus === 'EN_CORRECCION') {
    return 'EN_CORRECCION';
  }
  if (reportStatus === 'ENVIADO' || caseStatus === 'EN_REVISION') return 'EN_REVISION';
  if (evaluationStatus === 'FINALIZADA') return 'FINALIZADA';
  if (evaluationStatus === 'EN_PROCESO') return 'EN_PROCESO';
  if (
    evaluationStatus === 'PROGRAMADA'
    || evaluationStatus === 'REPROGRAMADA'
    || caseStatus === 'ASIGNADO'
    || caseStatus === 'EN_EVALUACION'
  ) {
    return 'ASIGNADO';
  }
  if (evaluationStatus === 'CANCELADA' && input.technicianId) return 'ASIGNADO';
  if (requestStatus === 'PENDIENTE_ASIGNACION' || caseStatus === 'ABIERTO') return 'PENDIENTE_ASIGNACION';
  return requestStatus || caseStatus || 'PENDIENTE_ASIGNACION';
}
