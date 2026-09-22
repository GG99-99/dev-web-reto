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
    <div className="heading compact"><div><small className="eyebrow">Operational Command & Workflows · RF-06 / RF-20</small><h1>Operations <em>Workbench</em></h1><p>Traceable execution across Multi-Origin Intake, Evaluator Assignment, and Official Sanctions.</p></div></div>
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
        notify(`Caso Institucional #${result.data.caseId} creado y listo para asignación.`)
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
        notify(`Técnico Evaluador asignado al caso #${selected.caseId}.`)
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
          <small className="eyebrow">Gestión de Casos Multi-Origen (RF-06)</small>
          <h2>Expedientes Activos ({filteredItems.length})</h2>
        </div>
        <button className="text" onClick={() => void refresh()}>Actualizar</button>
      </div>

      {/* Origin filter pills */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
        {[
          { id: 'ALL', name: 'Todos' },
          { id: 'SOLICITUD_EMPRESA', name: 'Empresas' },
          { id: 'PROGRAMACION_INSTITUCIONAL', name: 'Institucional' },
          { id: 'ALERTA_LAPCH', name: 'Alertas LAPCH' },
          { id: 'DENUNCIA', name: 'Denuncias' },
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

      {loading ? <p className="ops-empty">Cargando expedientes en vivo…</p> : <div className="ops-list">
        {filteredItems.map(item => <button className={selected?.caseId === item.caseId ? 'selected' : ''} key={item.caseId} onClick={() => void open(item)}>
          <b>#{item.caseId} · {item.institution?.name ?? 'Establecimiento no asignado'}</b>
          <span>
            <strong style={{ color: originColor(item.origin), fontSize: '0.72rem', textTransform: 'uppercase' }}>
              ● {label(item.origin)}
            </strong>
            · <mark className={item.priority === 'ALTA' ? 'high' : 'medium'}>{label(item.priority)}</mark>
            · {label(item.status)}
          </span>
        </button>)}
        {!filteredItems.length && <p className="ops-empty">No hay casos que coincidan con el filtro seleccionado.</p>}
      </div>}
    </section>

    <aside className="ops-stack">
      {/* Create Institutional Case */}
      <section className="card ops-card">
        <h2>Originación Institucional Directa (RF-06 Escenario 2)</h2>
        <form className="ops-form" onSubmit={create}>
          <label>Establecimiento / Empresa
            <select name="institutionId" required>
              <option value="">Seleccione un establecimiento</option>
              {institutions.map(i => <option key={i.institutionId} value={i.institutionId}>{i.name} (RNC: {i.rnc})</option>)}
            </select>
          </label>
          <label>Prioridad de Auditoría
            <select name="priority" defaultValue="MEDIA">
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta (Urgente)</option>
            </select>
          </label>
          <label>Motivo de la Programación
            <textarea name="motivo" required placeholder="Justificación técnica de la inspección programada..." />
          </label>
          <button className="primary">Crear Caso Institucional</button>
        </form>
      </section>

      {/* Selected Case Assignment & Actions */}
      {selected && <section className="card ops-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <h2 style={{ margin: 0 }}>Asignación · Caso #{selected.caseId}</h2>
          {onOpenDossier && (
            <button
              type="button"
              className="text"
              style={{ fontWeight: 700, color: '#00236f' }}
              onClick={() => onOpenDossier('CASE', selected.caseId)}
            >
              📁 Ver Expediente 360° →
            </button>
          )}
        </div>

        <form className="ops-form" onSubmit={assign}>
          <label>Técnico Evaluador Acreditado
            <select name="technicianId" required defaultValue={assignments[0]?.technicianId || ''}>
              <option value="">Seleccione evaluador para la comisión...</option>
              {technicians.map(t => <option key={t.userId} value={t.userId}>{t.person?.name ?? `Técnico #${t.userId}`} ({t.email})</option>)}
            </select>
          </label>
          <label>Instrucciones de Comisión / Nota de Asignación
            <input name="notes" placeholder="Notas sobre el alcance de la inspección" />
          </label>
          <button className="primary">{assignments.length ? 'Reasignar Evaluador' : 'Asignar Evaluador'}</button>
        </form>

        {assignments.length > 0 && (
          <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
            <strong style={{ fontSize: '0.76rem', color: '#64748b', textTransform: 'uppercase' }}>Historial de Asignaciones (RF-10)</strong>
            <ol className="ops-timeline" style={{ marginTop: '0.4rem' }}>
              {assignments.map(a => <li key={a.assignmentId}>
                <strong>{a.technician?.person?.name ?? `Usuario #${a.technicianId}`}</strong> · {a.isReassignment ? 'Reasignado' : 'Asignado'}
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
        notify(`Evaluación de campo #${result.data.evaluationId} programada en calendario.`)
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
        notify(result.data.informeOficialUrl ? 'Expediente cerrado y certificado oficial emitido.' : 'Expediente cerrado con éxito.')
        await refreshed()
      }
    } catch (e) {
      notify(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  return <section className="card ops-card">
    <h2>Programar Evaluación o Cerrar Expediente (RF-07 / RF-19)</h2>
    <form className="ops-form" onSubmit={schedule}>
      <label>Técnico Evaluador
        <select name="technicianId" required>
          <option value="">Seleccione evaluador</option>
          {technicians.map(t => <option key={t.userId} value={t.userId}>{t.person?.name ?? `Evaluador #${t.userId}`}</option>)}
        </select>
      </label>
      <label>Fecha y Hora Programada
        <input type="datetime-local" name="scheduledDate" required />
      </label>
      <label>Prioridad Sanitaria
        <select name="priority" defaultValue={caseItem.priority ?? 'MEDIA'}>
          <option value="BAJA">Baja</option>
          <option value="MEDIA">Media</option>
          <option value="ALTA">Alta</option>
        </select>
      </label>
      <label>Motivo Técnico
        <input name="reason" placeholder="Inspección BPM reglamentaria" />
      </label>
      <label>Notas para el Inspector
        <textarea name="observations" placeholder="Instrucciones previas para la visita in situ..." />
      </label>
      <button className="primary" disabled={busy}>Programar en Calendario</button>
    </form>

    <hr className="ops-rule" />

    <form className="ops-form" onSubmit={close}>
      <label>Dictamen de Cierre Final (RF-19)
        <textarea name="resultadoFinal" required placeholder="Documente la conclusión legal y sanitaria del expediente..." />
      </label>
      <label className="ops-check">
        <input type="checkbox" name="emitirInforme" defaultChecked />
        Generar y publicar Certificado Oficial Sanitario (PDF)
      </label>
      <button className="secondary ops-wide" disabled={busy}>Cerrar Expediente</button>
    </form>
  </section>
}

function ReportsPanel({ role, notify, onOpenOfficialReport }: any) {
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [report, setReport] = useState<any>()
  const [reviews, setReviews] = useState<any[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    evaluationsService.list({ page: 1, pageSize: 100 })
      .then(r => r.valid && setEvaluations(r.data.items))
      .catch(e => notify(apiError(e)))
  }, [])

  const select = async (id: string) => {
    setReport(undefined)
    setReviews([])
    if (!id) return
    try {
      const result = await reportsService.getByEvaluation(Number(id))
      if (result.valid) {
        setReport(result.data)
        const history = await reportsService.listReviews(result.data.reportId)
        if (history.valid) setReviews(history.data)
      }
    } catch (e) {
      notify(apiError(e))
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
        notify('Decisión de revisión registrada en la bitácora oficial.')
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
        notify(action === 'submit' ? 'Informe enviado a revisión de coordinación.' : 'Informe corregido reenviado.')
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
        notify('Corrección guardada. Puede reenviarla cuando esté lista.')
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
      <label className="ops-picker">Evaluación
        <select onChange={e => void select(e.target.value)} defaultValue="">
          <option value="">Seleccione una evaluación registrada...</option>
          {evaluations.map(item => (
            <option key={item.evaluationId} value={item.evaluationId}>
              #{item.evaluationId} · {item.institution?.name ?? 'Establecimiento'} · {label(item.status)}
            </option>
          ))}
        </select>
      </label>

      {report ? (
        <div className="report-live">
          <mark>{label(report.status)}</mark>
          <h2>{report.institution?.name ?? report.evaluation?.institution?.name ?? 'Informe de Inspección Sanitaria'}</h2>
          <p>Versión {report.version} · {report.locked ? '🔒 Bloqueado para revisión' : '✏️ Borrador editable'}</p>
          <h3>Hallazgos y No Conformidades</h3>
          <p>{report.noConformidades || 'No se han registrado no conformidades.'}</p>
          <h3>Recomendaciones Técnicas</h3>
          <p>{report.recomendaciones || 'Sin recomendaciones técnicas registradas.'}</p>
          {onOpenOfficialReport && (
            <button
              type="button"
              className="primary ops-wide"
              style={{ marginTop: '1.25rem', background: '#00236f', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              onClick={() => onOpenOfficialReport(report.evaluationId)}
            >
              📄 Ver Dictamen Oficial & Generar PDF
            </button>
          )}
        </div>
      ) : (
        <p className="ops-empty">Seleccione una evaluación para cargar su informe técnico y bitácora de revisión.</p>
      )}
    </section>

    <aside className="ops-stack">
      {report && ['ADMIN', 'COORDINADOR'].includes(role) && (
        <section className="card ops-card">
          <h2>Revisión del Coordinador (RF-17)</h2>
          <form className="ops-form" onSubmit={decision}>
            <label>Decisión Sanitaria
              <select name="action" defaultValue="APROBAR">
                <option value="APROBAR">Aprobar Informe y Emitir Dictamen</option>
                <option value="SOLICITAR_CORRECCION">Solicitar Correcciones al Evaluador</option>
                <option value="DEVOLVER">Devolver Informe</option>
              </select>
            </label>
            <label>Observaciones de Revisión
              <textarea name="comments" required placeholder="Fundamente la decisión o detalle las correcciones necesarias..." />
            </label>
            <button className="primary" disabled={busy}>Registrar Decisión</button>
          </form>
        </section>
      )}

      {report && role === 'TECNICO_EVALUADOR' && (
        <section className="card ops-card">
          <h2>Gestión de Correcciones (RF-18)</h2>
          <p className="ops-help">Los informes enviados quedan bloqueados hasta que el coordinador solicite una corrección.</p>
          {!report.locked && (
            <form className="ops-form" onSubmit={correct}>
              <label>Resumen Ejecutivo
                <textarea name="resumenEjecutivo" defaultValue={report.resumenEjecutivo ?? ''} />
              </label>
              <label>Hallazgos
                <textarea name="hallazgos" defaultValue={report.hallazgos ?? ''} />
              </label>
              <label>No Conformidades
                <textarea name="noConformidades" defaultValue={report.noConformidades ?? ''} />
              </label>
              <label>Recomendaciones
                <textarea name="recomendaciones" defaultValue={report.recomendaciones ?? ''} />
              </label>
              <button className="secondary ops-wide" disabled={busy}>Guardar Cambios</button>
            </form>
          )}
          <button className="primary" disabled={busy || report.locked} onClick={() => void technicianAction('submit')}>
            Enviar a Revisión
          </button>
          <button className="secondary ops-wide" disabled={busy || !report.locked} onClick={() => void technicianAction('resend')}>
            Reenviar Corrección
          </button>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="card ops-card">
          <h2>Bitácora de Revisiones</h2>
          <ol className="ops-timeline">
            {reviews.map(item => (
              <li key={item.reviewId}>
                <strong>{label(item.action)}</strong> · {item.comments || 'Sin comentarios adicionales'}
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
        notify(`Establecimiento "${result.data.name}" registrado correctamente.`)
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
          <small className="eyebrow">Padrón Sanitario (RF-03)</small>
          <h2>{['ADMIN', 'COORDINADOR'].includes(role) ? 'Establecimientos Regulados' : 'Mis Establecimientos'}</h2>
        </div>
        <button className="text" onClick={() => void load()}>Buscar</button>
      </div>
      <input className="ops-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por Razón Social, Nombre Comercial o RNC..." />
      <div className="ops-list">
        {items.map(item => (
          <div key={item.institutionId}>
            <b>{item.name}</b>
            <span>{item.nombreComercial || 'Sin nombre comercial'} · RNC {item.rnc} · {item.actividadEconomica || 'Alimentos'}</span>
          </div>
        ))}
        {!items.length && <p className="ops-empty">No se encontraron establecimientos con ese criterio. Puede registrar uno nuevo en el Portal de la Empresa.</p>}
      </div>
    </section>

    {role === 'ADMIN_EMPRESA' && (
      <section className="card ops-card">
        <h2>Registrar Nuevo Establecimiento</h2>
        <form className="ops-form two-col" onSubmit={create}>
          <label>Razón Social<input name="name" required /></label>
          <label>Nombre Comercial<input name="nombreComercial" required /></label>
          <label>RNC<input name="rnc" required /></label>
          <label>Actividad Económica<input name="actividadEconomica" required /></label>
          <label>Calle<input name="streetName" required /></label>
          <label>Número<input name="streetNum" required /></label>
          <label>Teléfono<input name="phoneNumber" required /></label>
          <label>Correo<input type="email" name="email" required /></label>
          <label>Provincia
            <select required onChange={e => void provinceChange(e.target.value)}>
              <option value="">Seleccione</option>
              {provinces.map(p => <option value={p.provinceId} key={p.provinceId}>{p.name}</option>)}
            </select>
          </label>
          <label>Municipio
            <select name="municipalityId" required>
              <option value="">Seleccione</option>
              {municipalities.map(m => <option value={m.municipalityId} key={m.municipalityId}>{m.name}</option>)}
            </select>
          </label>
          <button className="primary">Registrar</button>
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
        notify(`Solicitud BPM #${result.data.bpmRequestId} guardada como borrador.`)
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
        notify(`Solicitud enviada; se originó el caso #${result.data.case.caseId}.`)
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
          <small className="eyebrow">Trámites BPM (RF-05)</small>
          <h2>Solicitudes de Inspección</h2>
        </div>
        <button className="text" onClick={() => void load()}>Actualizar</button>
      </div>
      <div className="ops-list">
        {items.map(item => (
          <div key={item.bpmRequestId}>
            <b>#{item.bpmRequestId} · {item.institution?.name ?? 'Establecimiento'}</b>
            <span>
              {item.tipoEstablecimiento} · <mark>{label(item.status)}</mark>
              {item.status === 'BORRADOR' && (
                <button className="text" onClick={() => void submit(item.bpmRequestId)}>
                  🚀 Enviar a Evaluación
                </button>
              )}
            </span>
          </div>
        ))}
        {!items.length && <p className="ops-empty">No hay solicitudes BPM registradas en su ámbito de acceso.</p>}
      </div>
    </section>

    <section className="card ops-card">
      <h2>Crear Solicitud BPM</h2>
      <form className="ops-form" onSubmit={create}>
        <label>Establecimiento
          <select name="institutionId" required>
            <option value="">Seleccione establecimiento</option>
            {institutions.map(i => <option key={i.institutionId} value={i.institutionId}>{i.name}</option>)}
          </select>
        </label>
        <label>Tipo de Establecimiento
          <input name="tipoEstablecimiento" required placeholder="Ej: Planta de derivados lácteos" />
        </label>
        <label>Objetivo / Motivo
          <textarea name="motivo" required placeholder="Motivo de la solicitud..." />
        </label>
        <label>Observaciones
          <textarea name="observaciones" placeholder="Detalles operativos..." />
        </label>
        <label>Documento Obligatorio
          <input type="file" name="attachment" accept=".pdf,.doc,.docx,image/*" />
        </label>
        <button className="primary">Guardar Borrador</button>
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
        notify(`${mode === 'complaints' ? 'Denuncia ciudadana' : 'Alerta sanitaria LAPCH'} registrada exitosamente.`)
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
        notify(`Resultado de triaje guardado: ${result}.`)
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
        notify(`¡Caso #${response.data.case.caseId} generado con éxito con prioridad ALTA!`)
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
          🔬 Alertas Sanitarias LAPCH (RF-08)
        </button>
        <button className={mode === 'complaints' ? 'active' : ''} onClick={() => setMode('complaints')}>
          📢 Denuncias Ciudadanas (RF-09)
        </button>
      </div>

      <div className="ops-list">
        {items.map(item => {
          const id = mode === 'complaints' ? item.complaintId : item.alertId
          const result = item.resultado
          return (
            <div key={id} style={{ padding: '0.85rem 0' }}>
              <b>#{id} · {mode === 'complaints' ? item.tipoDenuncia : `Alerta: ${item.numeroAlerta} (${item.producto})`}</b>
              <p style={{ margin: '0.25rem 0', fontSize: '0.82rem', color: '#475569' }}>
                {item.descripcion}
              </p>
              <span>
                <strong>Triaje: </strong>
                <mark className={result === 'PROCEDE' ? 'high' : ''}>{label(result || 'PENDIENTE TRIAJE')}</mark>
                {!result && (
                  <>
                    <button className="text" style={{ color: '#047857', fontWeight: 700 }} onClick={() => void decide(item, 'PROCEDE')}>
                      ✓ Procede
                    </button>
                    <button className="text" style={{ color: '#ba1a1a', fontWeight: 700 }} onClick={() => void decide(item, 'NO_PROCEDE')}>
                      ✕ No Procede
                    </button>
                    {mode === 'complaints' && (
                      <button className="text" style={{ color: '#b45309' }} onClick={() => void decide(item, 'REMISION_OTRO_PROCESO')}>
                        ↗ Remitir
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
                    ⚡ Generar Caso Prioritario
                  </button>
                )}
              </span>
            </div>
          )
        })}
        {!items.length && <p className="ops-empty">No hay {mode === 'complaints' ? 'denuncias' : 'alertas LAPCH'} registradas.</p>}
      </div>
    </section>

    <section className="card ops-card">
      <h2>Registrar {mode === 'complaints' ? 'Denuncia Sanitaria' : 'Alerta Epidemiológica LAPCH'}</h2>
      <form className="ops-form" onSubmit={create}>
        <label>Establecimiento Involucrado
          <select name="institutionId" required={mode === 'lapch'}>
            <option value="">{mode === 'complaints' ? 'No vinculado / Desconocido' : 'Seleccione establecimiento'}</option>
            {institutions.map(i => <option key={i.institutionId} value={i.institutionId}>{i.name}</option>)}
          </select>
        </label>

        {mode === 'complaints' ? (
          <>
            <label>Tipo de Denuncia<input name="type" required placeholder="Ej: Venta de alimentos vencidos" /></label>
            <label>Denunciante / Fuente<input name="reporter" required placeholder="Nombre o 'Anónimo'" /></label>
          </>
        ) : (
          <>
            <label>No. Alerta Sanitaria LAPCH<input name="alertNumber" required placeholder="Ej: LAPCH-2026-AL-04" /></label>
            <label>Producto o Lote Afectado<input name="product" required placeholder="Ej: Leche Entera Pasteurizada Lote 904" /></label>
          </>
        )}

        <label>Fecha del Suceso / Recepción
          <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} />
        </label>
        <label>Descripción de los Hallazgos Toxi-Infecciosos o Infracciones
          <textarea name="description" required placeholder="Detalles de laboratorio o de la queja ciudadana..." />
        </label>
        <button className="primary">Registrar en Ingesta</button>
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
          <small className="eyebrow">Auditoría y Trazabilidad (RF-20)</small>
          <h2>Buscador Histórico Transversal</h2>
        </div>
      </div>
      <form className="ops-form two-col" onSubmit={search}>
        <label>Tipo de Registro
          <select name="entityType">
            <option value="">Todos los registros soportados</option>
            <option value="CASE">Expedientes / Casos</option>
            <option value="EVALUATION">Evaluaciones de Campo</option>
            <option value="BPM_REQUEST">Solicitudes BPM</option>
          </select>
        </label>
        <label>Estatus del Trámite
          <input name="status" placeholder="Ej: CERRADO, COMPLETADA..." />
        </label>
        <label>ID Establecimiento
          <input type="number" name="institutionId" min="1" placeholder="Ej: 1" />
        </label>
        <label>Desde
          <input type="date" name="from" />
        </label>
        <label>Hasta
          <input type="date" name="to" />
        </label>
        <button className="primary">Buscar Expedientes</button>
      </form>
    </section>

    <section className="card ops-card">
      <h2>Resultados ({items.length})</h2>
      <div className="ops-list">
        {items.map(item => (
          <div key={`${item.entityType}-${item.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0' }}>
            <div>
              <b>{label(item.entityType)} #{item.id} · {item.institution?.name}</b>
              <span>{label(item.status)} · {new Date(item.createdAt).toLocaleDateString('es-DO')}</span>
            </div>
            {onOpenDossier && (
              <button
                type="button"
                className="text"
                style={{ fontWeight: 700, color: '#00236f', whiteSpace: 'nowrap' }}
                onClick={() => onOpenDossier(item.entityType, item.id)}
              >
                📁 Ver 360° →
              </button>
            )}
          </div>
        ))}
        {!items.length && <p className="ops-empty">Utilice los filtros para explorar el registro histórico sanitario.</p>}
      </div>
    </section>
  </div>
}
