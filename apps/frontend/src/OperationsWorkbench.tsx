// API-backed operational workbench. The individual endpoints enforce role access;
// the UI also hides tools that cannot be used by the active role.
// @ts-nocheck
import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  assignmentsService, bpmRequestsService, casesService, complaintsService,
  evaluationsService, historyService, institutionsService, lapchAlertsService,
  reportsService, usersService,
} from './services'
import HistoricalDossierModal from './HistoricalDossierModal'
import './OperationsWorkbench.css'

type Role = 'ADMIN' | 'ADMIN_EMPRESA' | 'USUARIO_DELEGADO' | 'COORDINADOR' | 'TECNICO_EVALUADOR'
type Tab = 'cases' | 'reports' | 'institutions' | 'bpm' | 'intake' | 'history'
const label = (value?: string) => (value ?? '—').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
// The backend always replies with { valid:false, error: { code, message } } on
// failure (see ApiErrorResponse in API_CONTRACTS.md §0.1), so the message
// lives at error.response.data.error.message, not .error itself (that's an
// object and would crash React if rendered directly as a child).
const apiError = (error: any): string => {
  const apiErr = error?.response?.data?.error
  if (typeof apiErr === 'string') return apiErr
  if (apiErr?.message) return String(apiErr.message)
  if (error?.response?.data?.message) return String(error.response.data.message)
  return 'The action could not be completed. Please try again.'
}

export default function OperationsWorkbench({ role, initial, onOpenOfficialReport }: { role: Role; initial: Tab; onOpenOfficialReport?: (evaluationId: number) => void }) {
  const [tab, setTab] = useState<Tab>(initial)
  const [message, setMessage] = useState('')
  const [dossierTarget, setDossierTarget] = useState<{ entityType: string; id: number } | null>(null)

  const available = useMemo(() => [
    { id: 'cases' as Tab, name: 'Cases & Multi-Origin', roles: ['ADMIN', 'COORDINADOR'] },
    { id: 'reports' as Tab, name: 'Report review', roles: ['ADMIN', 'COORDINADOR', 'TECNICO_EVALUADOR'] },
    { id: 'institutions' as Tab, name: 'Institutions', roles: ['ADMIN', 'COORDINADOR', 'ADMIN_EMPRESA'] },
    { id: 'bpm' as Tab, name: 'BPM requests', roles: ['COORDINADOR', 'ADMIN_EMPRESA', 'USUARIO_DELEGADO'] },
    { id: 'intake' as Tab, name: 'Intake: Complaints & LAPCH', roles: ['ADMIN', 'COORDINADOR'] },
    { id: 'history' as Tab, name: 'History 360° Explorer', roles: ['ADMIN', 'COORDINADOR', 'ADMIN_EMPRESA'] },
  ].filter(item => item.roles.includes(role)), [role])

  useEffect(() => { if (!available.some(item => item.id === tab)) setTab(available[0]?.id ?? 'reports') }, [available, tab])

  return <section className="content operations">
    <div className="heading compact"><div><small className="eyebrow">Operational Command & Workflows</small><h1>Operations <em>Workbench</em></h1><p>Traceable execution across Multi-Origin Intake, Evaluator Assignment, and Official Sanctions.</p></div></div>
    <div className="ops-tabs" role="tablist">{available.map(item => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); setMessage('') }}>{item.name}</button>)}</div>
    {message && <div className="ops-message" role="status">ⓘ {message}</div>}

    {tab === 'cases' && <CasesPanel notify={setMessage} onOpenDossier={(entityType, id) => setDossierTarget({ entityType, id })} onOpenOfficialReport={onOpenOfficialReport} />}
    {tab === 'reports' && <ReportsPanel role={role} notify={setMessage} onOpenOfficialReport={onOpenOfficialReport} />}
    {tab === 'institutions' && <InstitutionsPanel role={role} notify={setMessage} />}
    {tab === 'bpm' && <BpmPanel notify={setMessage} />}
    {tab === 'intake' && <IntakePanel notify={setMessage} />}
    {tab === 'history' && <HistoryPanel notify={setMessage} onOpenDossier={(entityType, id) => setDossierTarget({ entityType, id })} />}

    {dossierTarget && (
      <HistoricalDossierModal
        entityType={dossierTarget.entityType as any}
        entityId={dossierTarget.id}
        onClose={() => setDossierTarget(null)}
        onOpenOfficialReport={onOpenOfficialReport}
        notify={setMessage}
      />
    )}
  </section>
}

function CasesPanel({ notify, onOpenDossier, onOpenOfficialReport }: any) {
  const [items, setItems] = useState<any[]>([])
  const [institutions, setInstitutions] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [selected, setSelected] = useState<any>()
  const [assignments, setAssignments] = useState<any[]>([])
  const [originFilter, setOriginFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try {
      const [c, i, t] = await Promise.all([
        casesService.list({ page: 1, pageSize: 50 }),
        institutionsService.list({ page: 1, pageSize: 100 }),
        usersService.list({ roleId: 5, status: 'APROBADO', page: 1, pageSize: 100 }),
      ])
      if (c.valid) setItems(c.data.items)
      if (i.valid) setInstitutions(i.data.items)
      if (t.valid) setTechnicians(t.data.items)
    } catch (e) {
      notify(apiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const open = async (item: any) => {
    setSelected(item)
    try {
      const result = await assignmentsService.listByCase(item.caseId)
      if (result.valid) setAssignments(result.data)
    } catch (e) {
      setAssignments([])
      notify(apiError(e))
    }
  }

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const result = await casesService.createInstitutional({
        institutionId: Number(data.get('institutionId')),
        priority: String(data.get('priority')) as any,
        motivo: String(data.get('motivo')),
      })
      if (result.valid) {
        notify(`Institutional Case #${result.data.caseId} created and ready for assignment.`)
        form.reset()
        await refresh()
      }
    } catch (e) {
      notify(apiError(e))
    }
  }

  const assign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected) return
    const data = new FormData(event.currentTarget)
    try {
      const technicianId = Number(data.get('technicianId'))
      const notes = String(data.get('notes') || '')
      const result = assignments.length
        ? await assignmentsService.reassign(selected.caseId, { technicianId, notes })
        : await assignmentsService.assign(selected.caseId, { technicianId, notes })
      if (result.valid) {
        notify(`Field Evaluator assigned to case #${selected.caseId}.`)
        await open(selected)
        await refresh()
      }
    } catch (e) {
      notify(apiError(e))
    }
  }

  const filteredItems = useMemo(() => {
    if (originFilter === 'ALL') return items
    return items.filter((it) => it.origin === originFilter)
  }, [items, originFilter])

  const originColor = (origin: string) => {
    switch (origin) {
      case 'SOLICITUD_EMPRESA': return '#00236f'
      case 'PROGRAMACION_INSTITUCIONAL': return '#0284c7'
      case 'ALERTA_LAPCH': return '#ba1a1a'
      case 'DENUNCIA': return '#b45309'
      default: return '#475569'
    }
  }

  return <div className="ops-grid">
    <section className="card ops-card">
      <div className="card-head">
        <div>
          <small className="eyebrow">Multi-Origin Case Management (RF-06)</small>
          <h2>Active Dossiers ({filteredItems.length})</h2>
        </div>
        <button className="text" onClick={() => void refresh()}>Refresh</button>
      </div>

      {/* Origin filter pills */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
        {[
          { id: 'ALL', name: 'All' },
          { id: 'SOLICITUD_EMPRESA', name: 'Company Requests' },
          { id: 'PROGRAMACION_INSTITUCIONAL', name: 'Institutional' },
          { id: 'ALERTA_LAPCH', name: 'LAPCH Alerts' },
          { id: 'DENUNCIA', name: 'Complaints' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            style={{
              padding: '0.3rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '999px',
              border: '1px solid #cbd5e1',
              background: originFilter === f.id ? '#00236f' : '#ffffff',
              color: originFilter === f.id ? '#ffffff' : '#334155',
              cursor: 'pointer',
            }}
            onClick={() => setOriginFilter(f.id)}
          >
            {f.name}
          </button>
        ))}
      </div>

      {loading ? <p className="ops-empty">Loading cases…</p> : <div className="ops-list">
        {filteredItems.map(item => <button className={selected?.caseId === item.caseId ? 'selected' : ''} key={item.caseId} onClick={() => void open(item)}>
          <b>#{item.caseId} · {item.institution?.name ?? 'Unassigned establishment'}</b>
          <span>
            <strong style={{ color: originColor(item.origin), fontSize: '0.72rem', textTransform: 'uppercase' }}>
              ● {label(item.origin)}
            </strong>
            · <mark className={item.priority === 'ALTA' ? 'high' : 'medium'}>{label(item.priority)}</mark>
            · {label(item.status)}
          </span>
        </button>)}
        {!filteredItems.length && <p className="ops-empty">No cases match the selected filter.</p>}
      </div>}
    </section>

    <aside className="ops-stack">
      {/* Create Institutional Case */}
      <section className="card ops-card">
        <h2>Create Institutional Case</h2>
        <form className="ops-form" onSubmit={create}>
          <label>Establishment / Company
            <select name="institutionId" required>
              <option value="">Select an establishment</option>
              {institutions.map(i => <option key={i.institutionId} value={i.institutionId}>{i.name} (RNC: {i.rnc})</option>)}
            </select>
          </label>
          <label>Audit Priority
            <select name="priority" defaultValue="MEDIA">
              <option value="BAJA">Low</option>
              <option value="MEDIA">Medium</option>
              <option value="ALTA">High (Urgent)</option>
            </select>
          </label>
          <label>Scheduling Reason
            <textarea name="motivo" required placeholder="Technical justification for the scheduled inspection..." />
          </label>
          <button className="primary">Create Institutional Case</button>
        </form>
      </section>

      {/* Selected Case Assignment & Actions */}
      {selected && <section className="card ops-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <h2 style={{ margin: 0 }}>Assignment · Case #{selected.caseId}</h2>
          {onOpenDossier && (
            <button
              type="button"
              className="text"
              style={{ fontWeight: 700, color: '#00236f' }}
              onClick={() => onOpenDossier('CASE', selected.caseId)}
            >
              📁 View 360° Dossier →
            </button>
          )}
        </div>

        <form className="ops-form" onSubmit={assign}>
          <label>Accredited Field Evaluator
            <select name="technicianId" required defaultValue={assignments[0]?.technicianId || ''}>
              <option value="">Select evaluator for this assignment...</option>
              {technicians.map(t => <option key={t.userId} value={t.userId}>{t.person?.name ?? `Technician #${t.userId}`} ({t.email})</option>)}
            </select>
          </label>
          <label>Assignment Instructions / Notes
            <input name="notes" placeholder="Notes about inspection scope" />
          </label>
          <button className="primary">{assignments.length ? 'Reassign Evaluator' : 'Assign Evaluator'}</button>
        </form>

        {assignments.length > 0 && (
          <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
            <strong style={{ fontSize: '0.76rem', color: '#64748b', textTransform: 'uppercase' }}>Assignment History</strong>
            <ol className="ops-timeline" style={{ marginTop: '0.4rem' }}>
              {assignments.map(a => <li key={a.assignmentId}>
                <strong>{a.technician?.person?.name ?? `User #${a.technicianId}`}</strong> · {a.isReassignment ? 'Reassigned' : 'Assigned'}
                {a.notes && <span> — "{a.notes}"</span>}
              </li>)}
            </ol>
          </div>
        )}
      </section>}

      {selected && <CaseLifecycle caseItem={selected} technicians={technicians} notify={notify} refreshed={refresh} />}
    </aside>
  </div>
}

function CaseLifecycle({ caseItem, technicians, notify, refreshed }: any) {
  const [busy, setBusy] = useState(false)

  const schedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true)
    try {
      const result = await evaluationsService.create({
        caseId: caseItem.caseId,
        technicianId: Number(data.get('technicianId')),
        scheduledDate: new Date(String(data.get('scheduledDate'))).toISOString(),
        priority: String(data.get('priority')) as any,
        reason: String(data.get('reason') || '') || undefined,
        observations: String(data.get('observations') || '') || undefined,
      })
      if (result.valid) {
        notify(`Field evaluation #${result.data.evaluationId} scheduled on calendar.`)
        form.reset()
        await refreshed()
      }
    } catch (e) {
      notify(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  const close = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const result = await casesService.close(caseItem.caseId, {
        resultadoFinal: String(data.get('resultadoFinal')),
        emitirInforme: data.get('emitirInforme') === 'on',
      })
      if (result.valid) {
        notify(result.data.informeOficialUrl ? 'Case closed and official certificate issued.' : 'Case closed successfully.')
        await refreshed()
      }
    } catch (e) {
      notify(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  return <section className="card ops-card">
    <h2>Schedule Evaluation or Close Case</h2>
    <form className="ops-form" onSubmit={schedule}>
      <label>Field Evaluator
        <select name="technicianId" required>
          <option value="">Select evaluator</option>
          {technicians.map(t => <option key={t.userId} value={t.userId}>{t.person?.name ?? `Evaluator #${t.userId}`}</option>)}
        </select>
      </label>
      <label>Scheduled Date & Time
        <input type="datetime-local" name="scheduledDate" required />
      </label>
      <label>Health Priority
        <select name="priority" defaultValue={caseItem.priority ?? 'MEDIA'}>
          <option value="BAJA">Low</option>
          <option value="MEDIA">Medium</option>
          <option value="ALTA">High</option>
        </select>
      </label>
      <label>Technical Reason
        <input name="reason" placeholder="Regulatory BPM inspection" />
      </label>
      <label>Inspector Notes
        <textarea name="observations" placeholder="Pre-visit instructions for the field inspection..." />
      </label>
      <button className="primary" disabled={busy}>Schedule on Calendar</button>
    </form>

    <hr className="ops-rule" />

    <form className="ops-form" onSubmit={close}>
      <label>Final Case Closure Decision
        <textarea name="resultadoFinal" required placeholder="Document the legal and health conclusion of this case..." />
      </label>
      <label className="ops-check">
        <input type="checkbox" name="emitirInforme" defaultChecked />
        Generate and publish Official Health Certificate (PDF)
      </label>
      <button className="secondary ops-wide" disabled={busy}>Close Case</button>
    </form>
  </section>
}

function ReportsPanel({ role, notify, onOpenOfficialReport }: any) {
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [selectedEval, setSelectedEval] = useState<any>()
  const [report, setReport] = useState<any>()
  const [reviews, setReviews] = useState<any[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    evaluationsService.list({ page: 1, pageSize: 100 })
      .then(r => {
        if (r.valid && r.data?.items) {
          setEvaluations(r.data.items)
        }
      })
      .catch(e => notify(apiError(e)))
  }, [])

  const select = async (id: string) => {
    setReport(undefined)
    setReviews([])
    if (!id) {
      setSelectedEval(undefined)
      return
    }

    const found = evaluations.find(item => String(item.evaluationId) === String(id))
    setSelectedEval(found)

    // Si la evaluación fue cancelada o aún no ha sido finalizada, no intentamos
    // cargar informe (el backend respondería 404 porque no genera informe técnico).
    if (found?.status === 'CANCELADA' || found?.status === 'PROGRAMADA' || found?.status === 'REPROGRAMADA') {
      return
    }

    try {
      const result = await reportsService.getByEvaluation(Number(id))
      if (result.valid) {
        setReport(result.data)
        const history = await reportsService.listReviews(result.data.reportId)
        if (history.valid) setReviews(history.data)
      }
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setReport(null)
      } else {
        notify(apiError(e))
      }
    }
  }

  const decision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!report) return
    const data = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const result = await reportsService.review(report.reportId, {
        action: String(data.get('action')) as any,
        comments: String(data.get('comments')),
      })
      if (result.valid) {
        notify('Review decision recorded successfully in the logbook.')
        await select(String(report.evaluationId))
      }
    } catch (e) {
      notify(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  const technicianAction = async (action: 'submit' | 'resend') => {
    if (!report) return
    setBusy(true)
    try {
      const result = action === 'submit'
        ? await reportsService.submit(report.reportId)
        : await reportsService.resend(report.reportId)
      if (result.valid) {
        notify(action === 'submit' ? 'Report submitted for coordinator review.' : 'Corrected report resubmitted.')
        await select(String(report.evaluationId))
      }
    } catch (e) {
      notify(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  const correct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!report) return
    const data = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const result = await reportsService.correct(report.reportId, {
        resumenEjecutivo: String(data.get('resumenEjecutivo') || '') || undefined,
        hallazgos: String(data.get('hallazgos') || '') || undefined,
        noConformidades: String(data.get('noConformidades') || '') || undefined,
        recomendaciones: String(data.get('recomendaciones') || '') || undefined,
      })
      if (result.valid) {
        notify('Correction saved. You can resubmit it when ready.')
        await select(String(report.evaluationId))
      }
    } catch (e) {
      notify(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  return <div className="ops-grid reports-live">
    <section className="card ops-card">
      <label className="ops-picker">Evaluation
        <select onChange={e => void select(e.target.value)} defaultValue="">
          <option value="">Select a registered evaluation...</option>
          {evaluations.map(item => (
            <option key={item.evaluationId} value={item.evaluationId}>
              #{item.evaluationId} · {item.institution?.name ?? 'Establishment'} · [{label(item.status)}]
            </option>
          ))}
        </select>
      </label>

      {/* Caso A: Evaluación Cancelada */}
      {selectedEval?.status === 'CANCELADA' ? (
        <div className="report-live">
          <mark style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}>
            ● Cancelled
          </mark>
          <h2>{selectedEval.institution?.name ?? 'Establishment'}</h2>
          <p>Evaluation #{selectedEval.evaluationId} · Originally scheduled for {new Date(selectedEval.scheduledDate).toLocaleDateString()}</p>
          <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '1.25rem', marginTop: '1rem' }}>
            <h3 style={{ color: '#c53030', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
              ⚠️ Evaluation Process Cancelled
            </h3>
            <p style={{ margin: 0, color: '#742a2a', fontSize: '0.9rem', lineHeight: '1.5' }}>
              This health evaluation was cancelled before completion. Per health regulations, cancelled evaluations do not generate a Technical Report or Official Certificate.
            </p>
            {selectedEval.observations && (
              <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #feb2b2' }}>
                <strong style={{ fontSize: '0.8rem', color: '#9b2c2c', textTransform: 'uppercase' }}>
                  Reason for cancellation / Observations:
                </strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#63171b', fontSize: '0.88rem' }}>
                  {selectedEval.observations}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : selectedEval && selectedEval.status !== 'FINALIZADA' && !report ? (
        /* Caso B: Evaluación en proceso o programada (sin informe) */
        <div className="report-live">
          <mark style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc' }}>
            ● {label(selectedEval.status)}
          </mark>
          <h2>{selectedEval.institution?.name ?? 'Establishment'}</h2>
          <p>Evaluation #{selectedEval.evaluationId} · Date: {new Date(selectedEval.scheduledDate).toLocaleDateString()}</p>
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '1.25rem', marginTop: '1rem' }}>
            <h3 style={{ color: '#0369a1', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
              ℹ️ Report Awaiting Field Conclusion
            </h3>
            <p style={{ margin: 0, color: '#0c4a6e', fontSize: '0.9rem', lineHeight: '1.5' }}>
              The health inspection report is generated automatically once the evaluator finishes the field evaluation form.
            </p>
          </div>
        </div>
      ) : report ? (
        /* Caso C: Informe existente */
        <div className="report-live">
          <mark>{label(report.status)}</mark>
          <h2>{report.institution?.name ?? report.evaluation?.institution?.name ?? selectedEval?.institution?.name ?? 'Health Inspection Report'}</h2>
          <p>Version {report.version} · {report.locked ? '🔒 Locked for review' : '✏️ Editable draft'}</p>
          <h3>Findings and Non-Conformities</h3>
          <p>{report.noConformidades || 'No non-conformities were recorded.'}</p>
          <h3>Technical Recommendations</h3>
          <p>{report.recomendaciones || 'No technical recommendations were recorded.'}</p>
          {onOpenOfficialReport && (
            <button
              type="button"
              className="primary ops-wide"
              style={{ marginTop: '1.25rem', background: '#00236f', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              onClick={() => onOpenOfficialReport(report.evaluationId)}
            >
              📄 View Official Certificate & Generate PDF
            </button>
          )}
        </div>
      ) : (
        <p className="ops-empty">Select an evaluation to load its technical report and review logbook.</p>
      )}
    </section>

    <aside className="ops-stack">
      {/* Caso Cancelada: Aviso en el panel derecho */}
      {selectedEval?.status === 'CANCELADA' && (
        <section className="card ops-card">
          <h2>Coordinator Review (RF-17)</h2>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>
            <p style={{ margin: 0 }}>
              Not applicable. Cancelled dossiers do not allow for the issuance of a health certificate or technical review.
            </p>
          </div>
        </section>
      )}

      {/* Formulario de Decisión: SOLO si el informe está en ENVIADO */}
      {report && ['ADMIN', 'COORDINADOR'].includes(role) && report.status === 'ENVIADO' && (
        <section className="card ops-card">
          <h2>Coordinator Review (RF-17)</h2>
          <form className="ops-form" onSubmit={decision}>
            <label>Health Decision
              <select name="action" defaultValue="APROBAR">
                <option value="APROBAR">Approve Report and Issue Certificate</option>
                <option value="SOLICITAR_CORRECCION">Request Corrections from Evaluator</option>
                <option value="DEVOLVER">Return Report</option>
              </select>
            </label>
            <label>Review Observations
              <textarea name="comments" required placeholder="Justify the decision or detail the necessary corrections..." />
            </label>
            <button className="primary" disabled={busy}>Record Decision</button>
          </form>
        </section>
      )}

      {/* Informe ya APROBADO: Mostrar estado oficial sin formulario fallido */}
      {report && ['ADMIN', 'COORDINADOR'].includes(role) && report.status === 'APROBADO' && (
        <section className="card ops-card">
          <h2>Coordinator Review (RF-17)</h2>
          <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.4rem', fontSize: '0.95rem' }}>
              <span>✅</span> Official Certificate Approved
            </div>
            <p style={{ margin: '0 0 0.75rem 0', color: '#15803d', lineHeight: '1.4' }}>
              This report has formal approval and an issued health certificate. The recorded decisions are final and immutable in accordance with current regulations.
            </p>
            {onOpenOfficialReport && (
              <button
                type="button"
                className="primary ops-wide"
                style={{ background: '#00236f', fontSize: '0.82rem' }}
                onClick={() => onOpenOfficialReport(report.evaluationId)}
              >
                📄 View Official Certificate & Generate PDF
              </button>
            )}
          </div>
        </section>
      )}

      {/* Informe en CORRECCIÓN o DEVUELTO */}
      {report && ['ADMIN', 'COORDINADOR'].includes(role) && (report.status === 'EN_CORRECCION' || report.status === 'DEVUELTO') && (
        <section className="card ops-card">
          <h2>Coordinator Review (RF-17)</h2>
          <div style={{ padding: '1rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              <span>✏️</span> {report.status === 'DEVUELTO' ? 'Report Returned' : 'In Correction by Evaluator'}
            </div>
            <p style={{ margin: 0, color: '#b45309', lineHeight: '1.4' }}>
              The report is with the evaluator to address observations. The review will be available again as soon as the technician resubmits the correction.
            </p>
          </div>
        </section>
      )}

      {/* Técnico Evaluador: Acciones de corrección */}
      {report && role === 'TECNICO_EVALUADOR' && (
        <section className="card ops-card">
          <h2>Corrections Management</h2>
          <p className="ops-help">Submitted reports remain locked until the coordinator requests a correction.</p>
          {!report.locked && (
            <form className="ops-form" onSubmit={correct}>
              <label>Executive Summary
                <textarea name="resumenEjecutivo" defaultValue={report.resumenEjecutivo ?? ''} />
              </label>
              <label>Findings
                <textarea name="hallazgos" defaultValue={report.hallazgos ?? ''} />
              </label>
              <label>Non-Conformities
                <textarea name="noConformidades" defaultValue={report.noConformidades ?? ''} />
              </label>
              <label>Recommendations
                <textarea name="recomendaciones" defaultValue={report.recomendaciones ?? ''} />
              </label>
              <button className="secondary ops-wide" disabled={busy}>Save Changes</button>
            </form>
          )}
          <button className="primary" disabled={busy || report.locked} onClick={() => void technicianAction('submit')}>
            Submit for Review
          </button>
          <button className="secondary ops-wide" disabled={busy || !report.locked} onClick={() => void technicianAction('resend')}>
            Resubmit Correction
          </button>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="card ops-card">
          <h2>Review Logbook</h2>
          <ol className="ops-timeline">
            {reviews.map(item => (
              <li key={item.reviewId}>
                <strong>{label(item.action)}</strong> · {item.comments || 'No additional comments'}
              </li>
            ))}
          </ol>
        </section>
      )}
    </aside>
  </div>
}

function InstitutionsPanel({ role, notify }: any) {
  const [items, setItems] = useState<any[]>([])
  const [provinces, setProvinces] = useState<any[]>([])
  const [municipalities, setMunicipalities] = useState<any[]>([])
  const [query, setQuery] = useState('')

  // GET /institutions is allowed for ADMIN, COORDINADOR, ADMIN_EMPRESA and
  // USUARIO_DELEGADO (see institutions.router.ts) — for the latter two the
  // backend auto-scopes results to institutions they own or represent, so
  // this call is safe (and necessary) for every role this panel is shown to.
  const load = async () => {
    try {
      const provincesResult = await institutionsService.listProvinces()
      if (provincesResult.valid) setProvinces(provincesResult.data)
      const r = await institutionsService.list({ q: query || undefined, page: 1, pageSize: 50 })
      if (r.valid) setItems(r.data.items)
    } catch (e) {
      notify(apiError(e))
    }
  }

  useEffect(() => { void load() }, [])

  const provinceChange = async (id: string) => {
    const r = await institutionsService.listMunicipalities(Number(id))
    if (r.valid) setMunicipalities(r.data)
  }

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const result = await institutionsService.create({
        name: String(data.get('name')),
        streetName: String(data.get('streetName')),
        streetNum: String(data.get('streetNum')),
        phoneNumber: String(data.get('phoneNumber')),
        email: String(data.get('email')),
        rnc: String(data.get('rnc')),
        nombreComercial: String(data.get('nombreComercial')),
        actividadEconomica: String(data.get('actividadEconomica')),
        municipalityId: Number(data.get('municipalityId')),
      })
      if (result.valid) {
        notify(`Establishment "${result.data.name}" registered successfully.`)
        form.reset()
        await load()
      }
    } catch (e) {
      notify(apiError(e))
    }
  }

  return <div className="ops-grid">
    <section className="card ops-card">
      <div className="card-head">
        <div>
          <small className="eyebrow">Health Registry</small>
          <h2>{['ADMIN', 'COORDINADOR'].includes(role) ? 'Regulated Establishments' : 'My Establishments'}</h2>
        </div>
        <button className="text" onClick={() => void load()}>Search</button>
      </div>
      <input className="ops-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by company name, trade name, or RNC..." />
      <div className="ops-list">
        {items.map(item => (
          <div key={item.institutionId}>
            <b>{item.name}</b>
            <span>{item.nombreComercial || 'No trade name'} · RNC {item.rnc} · {item.actividadEconomica || 'Food'}</span>
          </div>
        ))}
        {!items.length && <p className="ops-empty">No establishments found. You can register a new one in the Company Portal.</p>}
      </div>
    </section>

    {role === 'ADMIN_EMPRESA' && (
      <section className="card ops-card">
        <h2>Register New Establishment</h2>
        <form className="ops-form two-col" onSubmit={create}>
          <label>Legal Name<input name="name" required /></label>
          <label>Trade Name<input name="nombreComercial" required /></label>
          <label>RNC<input name="rnc" required onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) e.preventDefault() }} /></label>
          <label>Economic Activity<input name="actividadEconomica" required /></label>
          <label>Street<input name="streetName" required /></label>
          <label>Number<input name="streetNum" required /></label>
          <label>Phone<input name="phoneNumber" required /></label>
          <label>Email<input type="email" name="email" required /></label>
          <label>Province
            <select required onChange={e => void provinceChange(e.target.value)}>
              <option value="">Select</option>
              {provinces.map(p => <option value={p.provinceId} key={p.provinceId}>{p.name}</option>)}
            </select>
          </label>
          <label>Municipality
            <select name="municipalityId" required>
              <option value="">Select</option>
              {municipalities.map(m => <option value={m.municipalityId} key={m.municipalityId}>{m.name}</option>)}
            </select>
          </label>
          <button className="primary">Register</button>
        </form>
      </section>
    )}
  </div>
}

function BpmPanel({ notify }: any) {
  const [items, setItems] = useState<any[]>([])
  const [institutions, setInstitutions] = useState<any[]>([])

  const load = async () => {
    try {
      const result = await bpmRequestsService.list({ page: 1, pageSize: 50 })
      if (result.valid) {
        setItems(result.data.items)
        setInstitutions(result.data.items.map((item: any) => item.institution).filter(Boolean).filter((item: any, index: number, all: any[]) => all.findIndex((candidate: any) => candidate.institutionId === item.institutionId) === index))
      }
      try {
        const institutionsResult = await institutionsService.list({ page: 1, pageSize: 100 })
        if (institutionsResult.valid) setInstitutions(institutionsResult.data.items)
      } catch {
        // ignore
      }
    } catch (e) {
      notify(apiError(e))
    }
  }

  useEffect(() => { void load() }, [])

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const result = await bpmRequestsService.create({
        institutionId: Number(data.get('institutionId')),
        tipoEstablecimiento: String(data.get('tipoEstablecimiento')),
        motivo: String(data.get('motivo')),
        observaciones: String(data.get('observaciones') || ''),
      })
      if (result.valid) {
        const attachment = data.get('attachment')
        if (attachment instanceof File && attachment.size) {
          await bpmRequestsService.addAttachment(result.data.bpmRequestId, attachment)
        }
        notify(`BPM Request #${result.data.bpmRequestId} saved as draft.`)
        form.reset()
        await load()
      }
    } catch (e) {
      notify(apiError(e))
    }
  }

  const submit = async (id: number) => {
    try {
      const result = await bpmRequestsService.submit(id)
      if (result.valid) {
        notify(`Request submitted; Case #${result.data.case.caseId} was created.`)
        await load()
      }
    } catch (e) {
      notify(apiError(e))
    }
  }

  return <div className="ops-grid">
    <section className="card ops-card">
      <div className="card-head">
        <div>
          <small className="eyebrow">BPM Requests</small>
          <h2>Inspection Requests</h2>
        </div>
        <button className="text" onClick={() => void load()}>Refresh</button>
      </div>
      <div className="ops-list">
        {items.map(item => (
          <div key={item.bpmRequestId}>
            <b>#{item.bpmRequestId} · {item.institution?.name ?? 'Establishment'}</b>
            <span>
              {item.tipoEstablecimiento} · <mark>{label(item.status)}</mark>
              {item.status === 'BORRADOR' && (
                <button className="text" onClick={() => void submit(item.bpmRequestId)}>
                  🚀 Submit for Evaluation
                </button>
              )}
            </span>
          </div>
        ))}
        {!items.length && <p className="ops-empty">No BPM requests found in your scope.</p>}
      </div>
    </section>

    <section className="card ops-card">
      <h2>Create BPM Request</h2>
      <form className="ops-form" onSubmit={create}>
        <label>Establishment
          <select name="institutionId" required>
            <option value="">Select establishment</option>
            {institutions.map(i => <option key={i.institutionId} value={i.institutionId}>{i.name}</option>)}
          </select>
        </label>
        <label>Establishment Type
          <input name="tipoEstablecimiento" required placeholder="e.g. Dairy processing plant" />
        </label>
        <label>Objective / Reason
          <textarea name="motivo" required placeholder="Reason for the request..." />
        </label>
        <label>Observations
          <textarea name="observaciones" placeholder="Operational details..." />
        </label>
        <label>Required Document
          <input type="file" name="attachment" accept=".pdf,.doc,.docx,image/*" />
        </label>
        <button className="primary">Save Draft</button>
      </form>
    </section>
  </div>
}

function IntakePanel({ notify }: any) {
  const [mode, setMode] = useState<'complaints' | 'lapch'>('lapch')
  const [items, setItems] = useState<any[]>([])
  const [institutions, setInstitutions] = useState<any[]>([])

  const load = async () => {
    try {
      const [result, institutionResult] = await Promise.all([
        mode === 'complaints' ? complaintsService.list({ page: 1, pageSize: 50 }) : lapchAlertsService.list({ page: 1, pageSize: 50 }),
        institutionsService.list({ page: 1, pageSize: 100 }),
      ])
      if (result.valid) setItems(result.data.items)
      if (institutionResult.valid) setInstitutions(institutionResult.data.items)
    } catch (e) {
      notify(apiError(e))
    }
  }

  useEffect(() => { void load() }, [mode])

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const result = mode === 'complaints'
        ? await complaintsService.create({
            institutionId: Number(data.get('institutionId')) || undefined,
            tipoDenuncia: String(data.get('type')),
            fechaRecepcion: String(data.get('date')),
            denunciante: String(data.get('reporter')),
            descripcion: String(data.get('description')),
          })
        : await lapchAlertsService.create({
            institutionId: Number(data.get('institutionId')),
            numeroAlerta: String(data.get('alertNumber')),
            fecha: String(data.get('date')),
            producto: String(data.get('product')),
            descripcion: String(data.get('description')),
          })
      if (result.valid) {
        notify(`${mode === 'complaints' ? 'Public complaint' : 'LAPCH health alert'} registered successfully.`)
        form.reset()
        await load()
      }
    } catch (e) {
      notify(apiError(e))
    }
  }

  const decide = async (item: any, result: string) => {
    try {
      const response = mode === 'complaints'
        ? await complaintsService.setResult(item.complaintId, { resultado: result as any })
        : await lapchAlertsService.setResult(item.alertId, { resultado: result as any })
      if (response.valid) {
        notify(`Triage result saved: ${result}.`)
        await load()
      }
    } catch (e) {
      notify(apiError(e))
    }
  }

  const generate = async (item: any) => {
    try {
      const response = mode === 'complaints'
        ? await complaintsService.generateCase(item.complaintId)
        : await lapchAlertsService.generateCase(item.alertId)
      if (response.valid) {
        notify(`Case #${response.data.case.caseId} generated successfully with HIGH priority!`)
        await load()
      }
    } catch (e) {
      notify(apiError(e))
    }
  }

  return <div className="ops-grid">
    <section className="card ops-card">
      <div className="ops-subtabs">
        <button className={mode === 'lapch' ? 'active' : ''} onClick={() => setMode('lapch')}>
          🔬 LAPCH Sanitary Alerts
        </button>
        <button className={mode === 'complaints' ? 'active' : ''} onClick={() => setMode('complaints')}>
          📢 Public Complaints
        </button>
      </div>

      <div className="ops-list">
        {items.map(item => {
          const id = mode === 'complaints' ? item.complaintId : item.alertId
          const result = item.resultado
          return (
            <div key={id} style={{ padding: '0.85rem 0' }}>
              <b>#{id} · {mode === 'complaints' ? item.tipoDenuncia : `Alert: ${item.numeroAlerta} (${item.producto})`}</b>
              <p style={{ margin: '0.25rem 0', fontSize: '0.82rem', color: '#475569' }}>
                {item.descripcion}
              </p>
              <span>
                <strong>Triage: </strong>
                <mark className={result === 'PROCEDE' ? 'high' : ''}>{label(result || 'PENDING TRIAGE')}</mark>
                {!result && (
                  <>
                    <button className="text" style={{ color: '#047857', fontWeight: 700 }} onClick={() => void decide(item, 'PROCEDE')}>
                      ✓ Proceeds
                    </button>
                    <button className="text" style={{ color: '#ba1a1a', fontWeight: 700 }} onClick={() => void decide(item, 'NO_PROCEDE')}>
                      ✕ Does Not Proceed
                    </button>
                    {mode === 'complaints' && (
                      <button className="text" style={{ color: '#b45309' }} onClick={() => void decide(item, 'REMISION_OTRO_PROCESO')}>
                        ↗ Refer
                      </button>
                    )}
                  </>
                )}
                {result === 'PROCEDE' && (
                  <button
                    className="primary"
                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', marginLeft: '0.5rem' }}
                    onClick={() => void generate(item)}
                  >
                    ⚡ Generate Priority Case
                  </button>
                )}
              </span>
            </div>
          )
        })}
        {!items.length && <p className="ops-empty">No {mode === 'complaints' ? 'complaints' : 'LAPCH alerts'} registered.</p>}
      </div>
    </section>

    <section className="card ops-card">
      <h2>Register {mode === 'complaints' ? 'Health Complaint' : 'LAPCH Epidemiological Alert'}</h2>
      <form className="ops-form" onSubmit={create}>
        <label>Involved Establishment
          <select name="institutionId" required={mode === 'lapch'}>
            <option value="">{mode === 'complaints' ? 'Not linked / Unknown' : 'Select establishment'}</option>
            {institutions.map(i => <option key={i.institutionId} value={i.institutionId}>{i.name}</option>)}
          </select>
        </label>

        {mode === 'complaints' ? (
          <>
            <label>Complaint Type<input name="type" required placeholder="e.g. Sale of expired food products" /></label>
            <label>Complainant / Source<input name="reporter" required placeholder="Name or 'Anonymous'" /></label>
          </>
        ) : (
          <>
            <label>LAPCH Alert Number<input name="alertNumber" required placeholder="e.g. LAPCH-2026-AL-04" /></label>
            <label>Affected Product or Batch<input name="product" required placeholder="e.g. Pasteurized Whole Milk Batch 904" /></label>
          </>
        )}

        <label>Event / Reception Date
          <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} />
        </label>
        <label>Description of Findings / Infractions
          <textarea name="description" required placeholder="Laboratory details or citizen complaint details..." />
        </label>
        <button className="primary">Register Intake</button>
      </form>
    </section>
  </div>
}

function HistoryPanel({ notify, onOpenDossier }: any) {
  const [items, setItems] = useState<any[]>([])

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      const result = await historyService.search({
        entityType: String(data.get('entityType') || '') as any || undefined,
        status: String(data.get('status') || '') || undefined,
        fechaDesde: String(data.get('from') || '') || undefined,
        fechaHasta: String(data.get('to') || '') || undefined,
        institutionId: data.get('institutionId') ? Number(data.get('institutionId')) : undefined,
        page: 1,
        pageSize: 100,
      })
      if (result.valid) setItems(result.data.items)
    } catch (e) {
      notify(apiError(e))
    }
  }

  return <div className="ops-grid">
    <section className="card ops-card">
      <div className="card-head">
        <div>
          <small className="eyebrow">Audit & Traceability</small>
          <h2>Cross-Entity History Search</h2>
        </div>
      </div>
      <form className="ops-form two-col" onSubmit={search}>
        <label>Record Type
          <select name="entityType">
            <option value="">All supported records</option>
            <option value="CASE">Cases</option>
            <option value="EVALUATION">Field Evaluations</option>
            <option value="BPM_REQUEST">BPM Requests</option>
          </select>
        </label>
        <label>Process Status
          <input name="status" placeholder="e.g. CLOSED, COMPLETED..." />
        </label>
        <label>Establishment ID
          <input type="number" name="institutionId" min="1" placeholder="e.g. 1" />
        </label>
        <label>From
          <input type="date" name="from" />
        </label>
        <label>To
          <input type="date" name="to" />
        </label>
        <button className="primary">Search Records</button>
      </form>
    </section>

    <section className="card ops-card">
      <h2>Results ({items.length})</h2>
      <div className="ops-list">
        {items.map(item => (
          <div key={`${item.entityType}-${item.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0' }}>
            <div>
              <b>{label(item.entityType)} #{item.id} · {item.institution?.name}</b>
              <span>{label(item.status)} · {new Date(item.createdAt).toLocaleDateString('en-US')}</span>
            </div>
            {onOpenDossier && (
              <button
                type="button"
                className="text"
                style={{ fontWeight: 700, color: '#00236f', whiteSpace: 'nowrap' }}
                onClick={() => onOpenDossier(item.entityType, item.id)}
              >
                📁 View 360° →
              </button>
            )}
          </div>
        ))}
        {!items.length && <p className="ops-empty">Use the filters above to explore the health audit history.</p>}
      </div>
    </section>
  </div>
}
