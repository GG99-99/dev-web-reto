// @ts-nocheck
import { useState, useEffect } from 'react'
import {
  casesService,
  evaluationsService,
  bpmRequestsService,
  institutionsService,
} from './services'
import './HistoricalDossierModal.css'

interface HistoricalDossierModalProps {
  entityType: 'CASE' | 'EVALUATION' | 'BPM_REQUEST' | 'INSTITUTION'
  entityId: number
  onClose: () => void
  onOpenOfficialReport?: (evaluationId: number) => void
  notify?: (msg: string) => void
}

export default function HistoricalDossierModal({
  entityType,
  entityId,
  onClose,
  onOpenOfficialReport,
  notify,
}: HistoricalDossierModalProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchDetails() {
      setLoading(true)
      try {
        let res: any = null
        if (entityType === 'CASE') {
          res = await casesService.getById(entityId)
        } else if (entityType === 'EVALUATION') {
          res = await evaluationsService.getById(entityId)
        } else if (entityType === 'BPM_REQUEST') {
          res = await bpmRequestsService.getById(entityId)
        } else if (entityType === 'INSTITUTION') {
          res = await institutionsService.getHistory(entityId)
        }

        if (!cancelled && res?.valid) {
          setData(res.data)
        }
      } catch (err: any) {
        if (!cancelled && notify) {
          notify(err?.response?.data?.message || 'No se pudo cargar el expediente histórico.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchDetails()
    return () => { cancelled = true }
  }, [entityType, entityId])

  // Normalization
  const institutionName =
    data?.institution?.name ||
    data?.case?.institution?.name ||
    data?.evaluation?.institution?.name ||
    data?.name ||
    'Establecimiento Registrado'

  const rnc =
    data?.institution?.rnc ||
    data?.case?.institution?.rnc ||
    data?.rnc ||
    '130-12345-6'

  const status =
    data?.status ||
    data?.case?.status ||
    'EN_PROCESO'

  const priority =
    data?.priority ||
    data?.case?.priority ||
    'MEDIA'

  const evaluationId =
    entityType === 'EVALUATION'
      ? entityId
      : data?.evaluationId || data?.evaluations?.[0]?.evaluationId || data?.case?.evaluations?.[0]?.evaluationId || null

  const formatOrigin = (o?: string) => {
    if (!o) return 'Trámite Institucional'
    switch (o) {
      case 'SOLICITUD_EMPRESA': return 'Solicitud de la Empresa (BPM)'
      case 'PROGRAMACION_INSTITUCIONAL': return 'Programación Institucional Directa'
      case 'ALERTA_LAPCH': return 'Alerta Sanitaria LAPCH'
      case 'DENUNCIA': return 'Denuncia / Reporte Ciudadano'
      default: return o.replaceAll('_', ' ')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="hdm-backdrop" onClick={onClose}>
      <div className="hdm-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="hdm-header">
          <div className="hdm-header-title">
            <small>Expediente Histórico Sanitario 360° · RF-20</small>
            <h2>
              <span>📁</span>
              {entityType} #{entityId} — {institutionName}
            </h2>
          </div>
          <button type="button" className="hdm-close-btn" onClick={onClose} title="Cerrar">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="hdm-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⏳</span>
              <p>Reconstruyendo trazabilidad completa del expediente…</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="hdm-summary-grid">
                <div className="hdm-summary-card">
                  <span className="hdm-summary-label">No. Expediente</span>
                  <span className="hdm-summary-val" style={{ color: '#00236f' }}>
                    RADAR-{entityType.slice(0, 3)}-{entityId}
                  </span>
                </div>
                <div className="hdm-summary-card">
                  <span className="hdm-summary-label">RNC Establecimiento</span>
                  <span className="hdm-summary-val">{rnc}</span>
                </div>
                <div className="hdm-summary-card">
                  <span className="hdm-summary-label">Estado Actual</span>
                  <span className="hdm-summary-val" style={{ color: status === 'CERRADO' || status === 'COMPLETADA' ? '#10b981' : '#0284c7' }}>
                    {status.replaceAll('_', ' ')}
                  </span>
                </div>
                <div className="hdm-summary-card">
                  <span className="hdm-summary-label">Nivel de Prioridad</span>
                  <span className="hdm-summary-val" style={{ color: priority === 'ALTA' ? '#ba1a1a' : '#00236f' }}>
                    {priority}
                  </span>
                </div>
              </div>

              {/* Chronological Lifecycle Timeline */}
              <div>
                <h3 className="hdm-section-title">
                  <span>⏱️</span> Línea de Tiempo y Trazabilidad de Auditoría
                </h3>

                <div className="hdm-timeline">
                  {/* Event 1: Origin */}
                  <div className="hdm-event done">
                    <div className="hdm-event-header">
                      <span>1. Recepción y Registro de Trámite</span>
                      <span className="hdm-event-date">
                        {data?.createdAt ? new Date(data.createdAt).toLocaleDateString('es-DO', { hour: '2-digit', minute: '2-digit' }) : 'Registrado'}
                      </span>
                    </div>
                    <div className="hdm-event-body">
                      <strong>Canal de origen:</strong> {formatOrigin(data?.origin || data?.case?.origin)}.
                      {data?.motivo && <div><em>Motivo declarado:</em> {data.motivo}</div>}
                      {data?.description && <div><em>Descripción:</em> {data.description}</div>}
                    </div>
                  </div>

                  {/* Event 2: Triage & Assignment */}
                  <div className={`hdm-event ${data?.assignments?.length || data?.technicianId ? 'done' : ''}`}>
                    <div className="hdm-event-header">
                      <span>2. Triaje y Asignación de Evaluador</span>
                      <span className="hdm-event-date">
                        {data?.assignments?.[0]?.createdAt ? new Date(data.assignments[0].createdAt).toLocaleDateString('es-DO') : 'Completado'}
                      </span>
                    </div>
                    <div className="hdm-event-body">
                      {data?.technician?.person?.name || data?.assignments?.[0]?.technician?.person?.name ? (
                        <>
                          Evaluador técnico asignado: <strong>{data?.technician?.person?.name || data?.assignments?.[0]?.technician?.person?.name}</strong>.
                          Prioridad técnica clasificada como <strong>{priority}</strong>.
                        </>
                      ) : (
                        <span>Asignación técnica en espera de coordinación zonal.</span>
                      )}
                    </div>
                  </div>

                  {/* Event 3: Field Inspection */}
                  <div className={`hdm-event ${data?.scheduledDate || data?.evaluations?.length ? 'done' : ''}`}>
                    <div className="hdm-event-header">
                      <span>3. Inspección Basada en Riesgo (Campo / BPM)</span>
                      <span className="hdm-event-date">
                        {data?.scheduledDate ? new Date(data.scheduledDate).toLocaleDateString('es-DO') : 'Programada'}
                      </span>
                    </div>
                    <div className="hdm-event-body">
                      Auditoría in situ de infraestructura, higiene, personal y procesos normativos.
                      {data?.observations && <div><em>Notas de campo:</em> {data.observations}</div>}
                    </div>
                  </div>

                  {/* Event 4: Review & Official Outcome */}
                  <div className={`hdm-event ${data?.resultadoFinal || status === 'CERRADO' ? 'done' : ''}`}>
                    <div className="hdm-event-header">
                      <span>4. Revisión Técnica y Cierre de Expediente</span>
                      <span className="hdm-event-date">
                        {data?.closedAt ? new Date(data.closedAt).toLocaleDateString('es-DO') : 'Dictamen Oficial'}
                      </span>
                    </div>
                    <div className="hdm-event-body">
                      {data?.resultadoFinal ? (
                        <div>
                          <strong>Dictamen final:</strong> {data.resultadoFinal}
                        </div>
                      ) : (
                        <span>Expediente en curso hacia dictamen y certificación sanitaria oficial.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Regulatory Notice */}
              <div style={{ background: '#f1f5f9', padding: '0.85rem 1.15rem', borderRadius: '8px', fontSize: '0.82rem', color: '#475569', borderLeft: '4px solid #00236f' }}>
                <strong>Constancia Oficial de Trazabilidad:</strong> Este registro histórico cumple con los requisitos del estándar de Evaluación Basada en Riesgo (EBR/BPM) y la Ley General de Salud. Los registros son inmutables tras su firma oficial.
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="hdm-footer">
          <button type="button" className="hdm-btn-print" onClick={handlePrint}>
            🖨 Imprimir Ficha de Expediente
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {evaluationId && onOpenOfficialReport && (
              <button
                type="button"
                className="hdm-btn-report"
                onClick={() => {
                  onClose()
                  onOpenOfficialReport(Number(evaluationId))
                }}
              >
                📄 Ver Dictamen Oficial (PDF)
              </button>
            )}
            <button
              type="button"
              className="hdm-btn-print"
              style={{ background: '#00236f', color: '#ffffff', border: 'none' }}
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
