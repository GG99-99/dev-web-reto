const STATUS_LABELS: Record<string, string> = {
  BORRADOR: 'Draft',
  PENDIENTE_ASIGNACION: 'Pending Assignment',
  PENDIENTE_VALIDACION: 'Pending Validation',
  EN_REVISION: 'In Review',
  RECHAZADA: 'Rejected',
  RECHAZADO: 'Rejected',
  APROBADA: 'Approved',
  APROBADO: 'Approved',
  ASIGNADA: 'Assigned',
  ASIGNADO: 'Assigned',
  EN_PROCESO: 'In Progress',
  COMPLETADA: 'Completed',
  ABIERTO: 'Open',
  EN_EVALUACION: 'In Evaluation',
  CERRADO: 'Closed',
  PROGRAMADA: 'Scheduled',
  REPROGRAMADA: 'Rescheduled',
  CANCELADA: 'Cancelled',
  FINALIZADA: 'Finished',
  ENVIADO: 'Submitted',
  EN_CORRECCION: 'In Correction',
  DEVUELTO: 'Returned',
  NOT_AVAILABLE: 'Not Available',
  NOT_SET: 'Not Set',
  ALTA: 'High',
  MEDIA: 'Medium',
  BAJA: 'Low',
  CASE: 'Case',
  EVALUATION: 'Evaluation',
  BPM_REQUEST: 'BPM Request',
  INSTITUTION: 'Institution',
}

/** English label for a stored status, priority, or record-type code. */
export function statusLabel(value?: string | null): string {
  if (!value) return '—'
  if (STATUS_LABELS[value]) return STATUS_LABELS[value]
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}
