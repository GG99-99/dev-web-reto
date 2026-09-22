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
          notify(err?.response?.data?.message || 'Could not load the historical dossier.')
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
    'Not available'

  const rnc =
    data?.institution?.rnc ||
    data?.case?.institution?.rnc ||
    data?.rnc ||
    'Not recorded'

  const status =
    data?.status ||
    data?.case?.status ||
    'NOT_AVAILABLE'

  const priority =
    data?.priority ||
    data?.case?.priority ||
    'NOT_SET'

  const priorityLabel = (p?: string | null) => {
    if (!p) return '—';
    const map: Record<string, string> = { 'ALTA': 'High', 'MEDIA': 'Medium', 'BAJA': 'Low', 'NOT_SET': 'Not Set' };
    return map[p] ?? p.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  const evaluationId =
    entityType === 'EVALUATION'
      ? entityId
      : data?.evaluationId || data?.evaluations?.[0]?.evaluationId || data?.case?.evaluations?.[0]?.evaluationId || null

  const formatOrigin = (o?: string) => {
    if (!o) return 'Institutional Procedure'
    switch (o) {
      case 'SOLICITUD_EMPRESA': return 'Company Request (BPM)'
      case 'PROGRAMACION_INSTITUCIONAL': return 'Direct Institutional Programming'
      case 'ALERTA_LAPCH': return 'LAPCH Health Alert'
      case 'DENUNCIA': return 'Citizen Complaint / Report'
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
            <small>360° Sanitary Historical Dossier · RF-20</small>
            <h2>
              <span>📁</span>
              {entityType} #{entityId} — {institutionName}
            </h2>
          </div>
          <button type="button" className="hdm-close-btn" onClick={onClose} title="Close">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="hdm-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⏳</span>
              <p>Reconstructing complete traceability of the dossier…</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="hdm-summary-grid">
                <div className="hdm-summary-card">
                  <span className="hdm-summary-label">Dossier No.</span>
                  <span className="hdm-summary-val" style={{ color: '#00236f' }}>
                    RADAR-{entityType.slice(0, 3)}-{entityId}
                  </span>
                </div>
                <div className="hdm-summary-card">
                  <span className="hdm-summary-label">Establishment RNC</span>
                  <span className="hdm-summary-val">{rnc}</span>
                </div>
                <div className="hdm-summary-card">
                  <span className="hdm-summary-label">Current Status</span>
                  <span className="hdm-summary-val" style={{ color: status === 'CERRADO' || status === 'COMPLETADA' ? '#10b981' : '#0284c7' }}>
                    {status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </span>
                </div>
                <div className="hdm-summary-card">
                  <span className="hdm-summary-label">Priority Level</span>
                  <span className="hdm-summary-val" style={{ color: priority === 'ALTA' ? '#ba1a1a' : '#00236f' }}>
                    {priorityLabel(priority)}
                  </span>
                </div>
              </div>

              {/* Chronological Lifecycle Timeline */}
              <div>
                <h3 className="hdm-section-title">
                  <span>⏱️</span> Timeline and Audit Traceability
                </h3>

                <div className="hdm-timeline">
                  {/* Event 1: Origin */}
                  <div className="hdm-event done">
                    <div className="hdm-event-header">
                      <span>1. Receipt and Registration of Procedure</span>
                      <span className="hdm-event-date">
                        {data?.createdAt ? new Date(data.createdAt).toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Registered'}
                      </span>
                    </div>
                    <div className="hdm-event-body">
                      <strong>Origin channel:</strong> {formatOrigin(data?.origin || data?.case?.origin)}.
                      {data?.motivo && <div><em>Declared reason:</em> {data.motivo}</div>}
                      {data?.description && <div><em>Description:</em> {data.description}</div>}
                    </div>
                  </div>

                  {/* Event 2: Triage & Assignment */}
                  <div className={`hdm-event ${data?.assignments?.length || data?.technicianId ? 'done' : ''}`}>
                    <div className="hdm-event-header">
                      <span>2. Triage and Evaluator Assignment</span>
                      <span className="hdm-event-date">
                        {data?.assignments?.[0]?.createdAt ? new Date(data.assignments[0].createdAt).toLocaleDateString('en-US') : 'Completed'}
                      </span>
                    </div>
                    <div className="hdm-event-body">
                      {data?.technician?.person?.name || data?.assignments?.[0]?.technician?.person?.name ? (
                        <>
                          Assigned technical evaluator: <strong>{data?.technician?.person?.name || data?.assignments?.[0]?.technician?.person?.name}</strong>.
                          Technical priority classified as <strong>{priorityLabel(priority)}</strong>.
                        </>
                      ) : (
                        <span>Technical assignment pending zonal coordination.</span>
                      )}
                    </div>
                  </div>

                  {/* Event 3: Field Inspection */}
                  <div className={`hdm-event ${data?.scheduledDate || data?.evaluations?.length ? 'done' : ''}`}>
                    <div className="hdm-event-header">
                      <span>3. Risk-Based Inspection (Field / BPM)</span>
                      <span className="hdm-event-date">
                        {data?.scheduledDate ? new Date(data.scheduledDate).toLocaleDateString('en-US') : 'Scheduled'}
                      </span>
                    </div>
                    <div className="hdm-event-body">
                      On-site audit of infrastructure, hygiene, personnel, and regulatory processes.
                      {data?.observations && <div><em>Field notes:</em> {data.observations}</div>}
                    </div>
                  </div>

                  {/* Event 4: Review & Official Outcome */}
                  <div className={`hdm-event ${data?.resultadoFinal || status === 'CERRADO' ? 'done' : ''}`}>
                    <div className="hdm-event-header">
                      <span>4. Technical Review and Dossier Closure</span>
                      <span className="hdm-event-date">
                        {data?.closedAt ? new Date(data.closedAt).toLocaleDateString('en-US') : 'Official Report'}
                      </span>
                    </div>
                    <div className="hdm-event-body">
                      {data?.resultadoFinal ? (
                        <div>
                          <strong>Final report:</strong> {data.resultadoFinal}
                        </div>
                      ) : (
                        <span>Dossier in progress towards official sanitary certification and report.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Regulatory Notice */}
              <div style={{ background: '#f1f5f9', padding: '0.85rem 1.15rem', borderRadius: '8px', fontSize: '0.82rem', color: '#475569', borderLeft: '4px solid #00236f' }}>
                <strong>Official Traceability Record:</strong> This historical record complies with the requirements of the Risk-Based Evaluation standard (EBR/BPM) and the General Health Law. Records are immutable after their official signature.
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="hdm-footer">
          <button type="button" className="hdm-btn-print" onClick={handlePrint}>
            🖨 Print Dossier File
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
                📄 View Official Report (PDF)
              </button>
            )}
            <button
              type="button"
              className="hdm-btn-print"
              style={{ background: '#00236f', color: '#ffffff', border: 'none' }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
