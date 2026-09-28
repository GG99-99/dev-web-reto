import { deriveLifecycleStatus, pickCurrentEvaluation } from '@reto/shared'

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
  EN_CORRECCION: 'Returned for correction',
  DEVUELTO: 'Returned for full resubmission',
  SOLICITAR_CORRECCION: 'Request correction',
  DEVOLVER: 'Return for full resubmission',
  NOT_AVAILABLE: 'Not Available',
  NOT_SET: 'Not Set',
  ALTA: 'High',
  MEDIA: 'Medium',
  BAJA: 'Low',
  BAJO: 'Low',
  MEDIO: 'Medium',
  ALTO: 'High',
  ANUAL: 'Annual',
  SEMESTRAL: 'Semi-annual',
  TRIMESTRAL: 'Quarterly',
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

/** Status the company should see for one BPM request, preferring the server snapshot. */
export function requestLifecycle(request?: {
  status?: string | null
  lifecycleStatus?: string | null
  case?: {
    status?: string | null
    technicianId?: number | null
    evaluations?: Array<{ status?: string | null; createdAt?: string | null; report?: { status?: string | null } | null }> | null
  } | null
} | null): string {
  if (!request) return 'PENDIENTE_ASIGNACION'
  if (request.lifecycleStatus) return request.lifecycleStatus
  const evaluation = pickCurrentEvaluation(request.case?.evaluations)
  return deriveLifecycleStatus({
    requestStatus: request.status,
    caseStatus: request.case?.status,
    technicianId: request.case?.technicianId,
    evaluationStatus: evaluation?.status,
    reportStatus: evaluation?.report?.status,
  })
}

/** Status the company should see for one evaluation, including its report and case. */
export function evaluationLifecycle(evaluation?: {
  status?: string | null
  technicianId?: number | null
  report?: { status?: string | null } | null
  case?: { status?: string | null; technicianId?: number | null } | null
} | null): string {
  if (!evaluation) return 'PENDIENTE_ASIGNACION'
  if (evaluation.status === 'CANCELADA') return 'CANCELADA'
  return deriveLifecycleStatus({
    caseStatus: evaluation.case?.status,
    technicianId: evaluation.technicianId ?? evaluation.case?.technicianId,
    evaluationStatus: evaluation.status,
    reportStatus: evaluation.report?.status,
  })
}

/** 1 draft, 2 submitted, 3 assigned, 4 fieldwork or review, 5 decision. */
export function lifecycleStage(status?: string | null): number {
  switch (status) {
    case 'BORRADOR':
      return 1
    case 'PENDIENTE_ASIGNACION':
      return 2
    case 'ASIGNADO':
      return 3
    case 'EN_PROCESO':
    case 'FINALIZADA':
    case 'ENVIADO':
    case 'EN_REVISION':
    case 'EN_CORRECCION':
      return 4
    case 'APROBADA':
    case 'APROBADO':
    case 'CERRADO':
    case 'COMPLETADA':
      return 5
    case 'RECHAZADA':
    case 'RECHAZADO':
      return -1
    default:
      return 0
  }
}

const OPEN_LIFECYCLE = new Set([
  'PENDIENTE_ASIGNACION',
  'ASIGNADO',
  'EN_PROCESO',
  'FINALIZADA',
  'ENVIADO',
  'EN_REVISION',
  'EN_CORRECCION',
])

const DONE_LIFECYCLE = new Set(['APROBADA', 'APROBADO', 'CERRADO', 'COMPLETADA'])

export function isOpenLifecycle(status?: string | null): boolean {
  return OPEN_LIFECYCLE.has(status ?? '')
}

export function isDoneLifecycle(status?: string | null): boolean {
  return DONE_LIFECYCLE.has(status ?? '')
}
