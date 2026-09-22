// @ts-nocheck
import { useState, useEffect, useMemo, FormEvent } from 'react'
import {
  bpmRequestsService,
  institutionsService,
  evaluationsService,
  dashboardService,
} from './services'
import './CompanyPortal.css'

type Role = 'ADMIN' | 'ADMIN_EMPRESA' | 'USUARIO_DELEGADO' | 'COORDINADOR' | 'TECNICO_EVALUADOR'

interface CompanyPortalProps {
  role: Role
  notify: (msg: string) => void
  onOpenOfficialReport?: (evaluationId: number) => void
}

type TabKey = 'requests' | 'institutions' | 'evaluations'

export default function CompanyPortal({ role, notify, onOpenOfficialReport }: CompanyPortalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('requests')
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<any[]>([])
  const [institutions, setInstitutions] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [selectedReqDetail, setSelectedReqDetail] = useState<any | null>(null)

  // Modals
  const [showNewRequestModal, setShowNewRequestModal] = useState(false)
  const [showNewInstitutionModal, setShowNewInstitutionModal] = useState(false)
  const [showAddRepresentModal, setShowAddRepresentModal] = useState(false)
  const [selectedInstForRep, setSelectedInstForRep] = useState<number | null>(null)

  const [instFormError, setInstFormError] = useState('')
  const [repFormError, setRepFormError] = useState('')
  const [showEditInstitutionModal, setShowEditInstitutionModal] = useState(false)
  const [editingInstitution, setEditingInstitution] = useState<any>(null)
  const [editFormError, setEditFormError] = useState('')

  // Geographic selectors for institution creation
  const [provinces, setProvinces] = useState<any[]>([])
  const [municipalities, setMunicipalities] = useState<any[]>([])
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>('')

  // Upload progress / busy
  const [submitting, setSubmitting] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  // Fetch initial data
  const loadData = async () => {
    setLoading(true)
    try {
      const isCompanyRole = role === 'ADMIN_EMPRESA' || role === 'USUARIO_DELEGADO'
      const [reqRes, instRes, dashRes, evalRes] = await Promise.allSettled([
        bpmRequestsService.list({ page: 1, pageSize: 50 }),
        institutionsService.list({ page: 1, pageSize: 50 }),
        isCompanyRole ? dashboardService.getEmpresaDashboard() : Promise.resolve({ valid: false, data: null }),
        !isCompanyRole ? evaluationsService.list({ page: 1, pageSize: 50 }) : Promise.resolve({ valid: false, data: null }),
      ])

      let loadedRequests: any[] = []
      let loadedInstitutions: any[] = []
      let loadedEvaluations: any[] = []

      if (reqRes.status === 'fulfilled' && reqRes.value?.valid) {
        loadedRequests = reqRes.value.data.items || []
      }

      if (instRes.status === 'fulfilled' && instRes.value?.valid) {
        loadedInstitutions = instRes.value.data.items || []
      }

      if (dashRes.status === 'fulfilled' && dashRes.value?.valid) {
        const d = dashRes.value.data as any
        if (d?.evaluaciones?.length) {
          loadedEvaluations = d.evaluaciones
        }
        if (!loadedRequests.length && d?.misSolicitudes?.length) {
          loadedRequests = d.misSolicitudes
        }
      }

      if (evalRes.status === 'fulfilled' && evalRes.value?.valid) {
        loadedEvaluations = evalRes.value.data.items || []
      }

      // If institutions is still empty, derive from requests or evaluations
      if (!loadedInstitutions.length) {
        const fromReq = loadedRequests.map((r: any) => r.institution).filter(Boolean)
        const fromEval = loadedEvaluations.map((e: any) => e.institution).filter(Boolean)
        const combined = [...fromReq, ...fromEval].filter(
          (inst: any, index: number, all: any[]) => all.findIndex((candidate: any) => candidate.institutionId === inst.institutionId) === index
        )
        if (combined.length) loadedInstitutions = combined
      }

      setRequests(loadedRequests)
      setInstitutions(loadedInstitutions)
      setEvaluations(loadedEvaluations)

      if (loadedRequests.length > 0 && !selectedRequestId) {
        setSelectedRequestId(loadedRequests[0].bpmRequestId)
      }
    } catch (err) {
      console.error('Error loading CompanyPortal data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  // Load provinces on demand
  useEffect(() => {
    if (showNewInstitutionModal && provinces.length === 0) {
      institutionsService.listProvinces().then((res) => {
        if (res.valid) setProvinces(res.data)
      }).catch(() => {})
    }
  }, [showNewInstitutionModal, provinces.length])

  // Fetch municipalities when province changes
  const handleProvinceChange = async (provinceId: string) => {
    setSelectedProvinceId(provinceId)
    setMunicipalities([])
    if (!provinceId) return
    try {
      const res = await institutionsService.listMunicipalities(Number(provinceId))
      if (res.valid) setMunicipalities(res.data)
    } catch {
      // ignore
    }
  }

  // Fetch full details when selected request changes
  useEffect(() => {
    if (!selectedRequestId) {
      setSelectedReqDetail(null)
      return
    }
    let cancelled = false
    bpmRequestsService.getById(selectedRequestId).then((res) => {
      if (!cancelled && res.valid) {
        setSelectedReqDetail(res.data)
      }
    }).catch(() => {
      if (!cancelled) {
        // Fallback to list item
        const fallback = requests.find((r) => r.bpmRequestId === selectedRequestId)
        setSelectedReqDetail(fallback || null)
      }
    })
    return () => { cancelled = true }
  }, [selectedRequestId, requests])

  // Primary institution (e.g. first registered establishment)
  const mainInstitution = useMemo(() => institutions[0] || null, [institutions])

  // Company Metrics calculation
  const metrics = useMemo(() => {
    const totalRequests = requests.length
    const inProgress = requests.filter((r) => ['PENDIENTE_ASIGNACION', 'ASIGNADA', 'EN_PROCESO'].includes(r.status)).length
    const drafts = requests.filter((r) => r.status === 'BORRADOR').length
    const completed = requests.filter((r) => r.status === 'COMPLETADA' || r.status === 'APROBADO').length
    return { totalRequests, inProgress, drafts, completed }
  }, [requests])

  // Submit draft request to evaluation
  const handleSubmitRequest = async (id: number) => {
    if (!confirm('Submit this BPM evaluation request to the health authority?')) return
    setSubmitting(true)
    try {
      const res = await bpmRequestsService.submit(id)
      if (res.valid) {
        notify(`Request #${id} submitted successfully! Case #${res.data?.case?.caseId ?? ''} has been created for evaluation.`)
        await loadData()
      }
    } catch (err: any) {
      notify(err?.response?.data?.message || 'Could not submit the request.')
    } finally {
      setSubmitting(false)
    }
  }

  // Attach document to current request
  const handleAddAttachment = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedRequestId || !uploadFile) return
    setSubmitting(true)
    try {
      const res = await bpmRequestsService.addAttachment(selectedRequestId, uploadFile)
      if (res.valid) {
        notify('Document attached successfully.')
        setUploadFile(null)
        // Refresh request detail
        const detailRes = await bpmRequestsService.getById(selectedRequestId)
        if (detailRes.valid) setSelectedReqDetail(detailRes.data)
      }
    } catch (err: any) {
      notify(err?.response?.data?.message || 'Error attaching document.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle New Request Creation
  const handleCreateRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const instId = Number(form.get('institutionId'))
    const tipoEstablecimiento = String(form.get('tipoEstablecimiento') || '')
    const motivo = String(form.get('motivo') || '')
    const observaciones = String(form.get('observaciones') || '')
    const file = form.get('attachment') as File | null
    const submitDirectly = form.get('submitDirectly') === 'true'

    if (!instId || !tipoEstablecimiento || !motivo) {
      notify('Please complete all required fields.')
      return
    }

    setSubmitting(true)
    try {
      const res = await bpmRequestsService.create({
        institutionId: instId,
        tipoEstablecimiento,
        motivo,
        observaciones,
      })

      if (res.valid) {
        const newId = res.data.bpmRequestId
        if (file && file.size > 0) {
          try {
            await bpmRequestsService.addAttachment(newId, file)
          } catch {
            notify('Request created, but there was an error uploading the attachment.')
          }
        }

        if (submitDirectly) {
          try {
            await bpmRequestsService.submit(newId)
            notify(`BPM Request #${newId} created and submitted for technical review.`)
          } catch {
            notify(`BPM Request #${newId} saved as draft (could not submit automatically).`)
          }
        } else {
          notify(`BPM Request #${newId} saved as draft.`)
        }

        setShowNewRequestModal(false)
        await loadData()
        setSelectedRequestId(newId)
      }
    } catch (err: any) {
      notify(err?.response?.data?.message || 'Error creating BPM request.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Register Institution
  const handleCreateInstitution = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setInstFormError('')
    const form = new FormData(e.currentTarget)
    const body = {
      name: String(form.get('name') || ''),
      nombreComercial: String(form.get('nombreComercial') || ''),
      rnc: String(form.get('rnc') || ''),
      actividadEconomica: String(form.get('actividadEconomica') || ''),
      streetName: String(form.get('streetName') || ''),
      streetNum: String(form.get('streetNum') || ''),
      phoneNumber: String(form.get('phoneNumber') || ''),
      email: String(form.get('email') || ''),
      municipalityId: Number(form.get('municipalityId')),
    }

    setSubmitting(true)
    try {
      const res = await institutionsService.create(body)
      if (res.valid) {
        notify(`Establishment "${res.data.name}" registered successfully.`)
        setShowNewInstitutionModal(false)
        await loadData()
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error registering establishment.'
      setInstFormError(msg)
      notify(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Edit Institution
  const handleEditInstitution = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingInstitution) return
    setEditFormError('')
    const form = new FormData(e.currentTarget)
    const body = {
      name: String(form.get('name') || ''),
      nombreComercial: String(form.get('nombreComercial') || '') || undefined,
      rnc: String(form.get('rnc') || ''),
      actividadEconomica: String(form.get('actividadEconomica') || '') || undefined,
      streetName: String(form.get('streetName') || ''),
      streetNum: String(form.get('streetNum') || '') || undefined,
      phoneNumber: String(form.get('phoneNumber') || ''),
      email: String(form.get('email') || ''),
    }
    setSubmitting(true)
    try {
      const res = await institutionsService.update(editingInstitution.institutionId, body)
      if (res.valid) {
        notify(`Establishment "${res.data.name}" updated successfully.`)
        setShowEditInstitutionModal(false)
        setEditingInstitution(null)
        await loadData()
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Could not update establishment. Please try again.'
      setEditFormError(msg)
      notify(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Add Representative
  // NOTE: backend CreateRepresentSchema (institutions.schemas.ts) only accepts
  // { person: {name,cedula,phone,email}, type: 'LEGAL'|'CALIDAD'|'CONTACTO' } —
  // there is no "cargo" field and no "CONTACTO_PRINCIPAL" enum value (it's
  // just "CONTACTO"). The "cargo" the user enters has nowhere to persist on
  // the backend today, so it is intentionally dropped rather than sent.
  const handleAddRepresentative = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setRepFormError('')
    if (!selectedInstForRep) return
    const form = new FormData(e.currentTarget)
    const rawTipo = String(form.get('tipo') || 'CALIDAD')
    const type = (rawTipo === 'CONTACTO_PRINCIPAL' ? 'CONTACTO' : rawTipo) as 'LEGAL' | 'CALIDAD' | 'CONTACTO'
    const body = {
      person: {
        name: String(form.get('name') || ''),
        email: String(form.get('email') || ''),
        phone: String(form.get('phone') || ''),
        cedula: String(form.get('cedula') || ''),
      },
      type,
    }

    setSubmitting(true)
    try {
      const res = await institutionsService.addRepresentative(selectedInstForRep, body)
      if (res.valid) {
        notify('Representative assigned successfully.')
        setShowAddRepresentModal(false)
        await loadData()
        setActiveTab('institutions')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error adding representative.'
      setRepFormError(msg)
      notify(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Calculate timeline stepper stage (1 to 5)
  const getTimelineStage = (status?: string) => {
    switch (status) {
      case 'BORRADOR':
        return 1
      case 'PENDIENTE_ASIGNACION':
        return 2
      case 'ASIGNADA':
        return 3
      case 'EN_PROCESO':
        return 4
      case 'COMPLETADA':
      case 'APROBADO':
        return 5
      case 'RECHAZADA':
        return -1
      default:
        return 2
    }
  }

  const currentStage = getTimelineStage(selectedReqDetail?.status)

  // Status semantic class
  const getBadgeClass = (st?: string) => {
    switch (st) {
      case 'BORRADOR': return 'cp-badge-draft'
      case 'PENDIENTE_ASIGNACION': return 'cp-badge-pending'
      case 'ASIGNADA': return 'cp-badge-assigned'
      case 'EN_PROCESO': return 'cp-badge-in-progress'
      case 'COMPLETADA':
      case 'APROBADO': return 'cp-badge-done'
      case 'RECHAZADA': return 'cp-badge-rejected'
      default: return 'cp-badge-pending'
    }
  }

  const formatStatus = (st?: string) => {
    if (!st) return '—'
    const statusMap: Record<string, string> = {
      'BORRADOR': 'Draft',
      'PENDIENTE_ASIGNACION': 'Pending Assignment',
      'ASIGNADA': 'Assigned',
      'EN_PROCESO': 'In Progress',
      'COMPLETADA': 'Completed',
      'APROBADO': 'Approved',
      'RECHAZADA': 'Rejected'
    }
    return statusMap[st] || st.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return (
    <section className="company-portal">
      {/* 1. Header Hero Banner */}
      <div className="cp-hero">
        <div className="cp-hero-info">
          <small>Regulated Establishment Portal · BPM</small>
          <h1>{mainInstitution?.name || 'Company Self-Service Portal'}</h1>
          <p>
            <span>🏢 RNC: <strong>{mainInstitution?.rnc || '130-99887-1'}</strong></span>
            <span>📍 {mainInstitution?.streetName ? `${mainInstitution.streetName} #${mainInstitution.streetNum || ''}` : 'Santiago de los Caballeros, RD'}</span>
            <span>📞 {mainInstitution?.phoneNumber || '(809) 580-0000'}</span>
            <span>✉ {mainInstitution?.email || 'contacto@empresa.com.do'}</span>
          </p>
        </div>
        <div className="cp-hero-actions">
          <button
            type="button"
            className="cp-btn-white"
            onClick={() => setShowNewRequestModal(true)}
          >
            ➕ New BPM Request
          </button>
          <button
            type="button"
            className="cp-btn-white"
            style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
            onClick={() => setShowNewInstitutionModal(true)}
          >
            🏭 Register Establishment
          </button>
        </div>
      </div>

      {/* 2. Metrics Row */}
      <div className="cp-metrics-row">
        <div className="cp-metric-card">
          <div className="cp-metric-icon cp-icon-blue">📋</div>
          <div className="cp-metric-text">
            <span className="cp-metric-label">Total Requests</span>
            <span className="cp-metric-val">{metrics.totalRequests}</span>
          </div>
        </div>
        <div className="cp-metric-card">
          <div className="cp-metric-icon cp-icon-amber">⏳</div>
          <div className="cp-metric-text">
            <span className="cp-metric-label">In Evaluation / Assigned</span>
            <span className="cp-metric-val">{metrics.inProgress}</span>
          </div>
        </div>
        <div className="cp-metric-card">
          <div className="cp-metric-icon cp-icon-purple">📝</div>
          <div className="cp-metric-text">
            <span className="cp-metric-label">Pending Drafts</span>
            <span className="cp-metric-val">{metrics.drafts}</span>
          </div>
        </div>
        <div className="cp-metric-card">
          <div className="cp-metric-icon cp-icon-green">🛡</div>
          <div className="cp-metric-text">
            <span className="cp-metric-label">Completed Decisions</span>
            <span className="cp-metric-val">{metrics.completed}</span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="cp-nav-tabs">
        <button
          type="button"
          className={`cp-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          📄 My BPM Requests
        </button>
        <button
          type="button"
          className={`cp-tab-btn ${activeTab === 'institutions' ? 'active' : ''}`}
          onClick={() => setActiveTab('institutions')}
        >
          🏢 Establishments & Representatives
        </button>
        <button
          type="button"
          className={`cp-tab-btn ${activeTab === 'evaluations' ? 'active' : ''}`}
          onClick={() => setActiveTab('evaluations')}
        >
          🎖 Official Certificates & Evaluations
        </button>
      </div>

      {/* 4. Tab 1: Mis Solicitudes BPM */}
      {activeTab === 'requests' && (
        <div className="cp-content-grid">
          {/* Left: Requests List */}
          <div className="cp-card">
            <div className="cp-card-header">
              <h2><span>🗂</span> Registered Requests ({requests.length})</h2>
              <button
                type="button"
                className="cp-btn-secondary"
                onClick={() => void loadData()}
              >
                🔄 Refresh
              </button>
            </div>

            {loading ? (
              <div className="cp-empty"><span>⏳</span><p>Loading company BPM requests…</p></div>
            ) : requests.length === 0 ? (
              <div className="cp-empty">
                <span>📂</span>
                <h3>No requests registered</h3>
                <p>Start a BPM risk evaluation request for your food facilities.</p>
                <button
                  type="button"
                  className="cp-btn-primary"
                  onClick={() => setShowNewRequestModal(true)}
                >
                  ➕ Create first BPM request
                </button>
              </div>
            ) : (
              <div className="cp-requests-list">
                {requests.map((req) => (
                  <div
                    key={req.bpmRequestId}
                    className={`cp-request-row ${selectedRequestId === req.bpmRequestId ? 'selected' : ''}`}
                    onClick={() => setSelectedRequestId(req.bpmRequestId)}
                  >
                    <div className="cp-req-main">
                      <div className="cp-req-title">
                        <span>#{req.bpmRequestId}</span>
                        <strong>{req.institution?.name || 'Establishment'}</strong>
                      </div>
                      <div className="cp-req-sub">
                        <span>🏷 {req.tipoEstablecimiento || 'General'}</span>
                        <span>📅 {new Date(req.createdAt).toLocaleDateString('es-DO')}</span>
                      </div>
                    </div>
                    <div className="cp-req-side">
                      <span className={`cp-badge ${getBadgeClass(req.status)}`}>
                        {formatStatus(req.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Selected Request Detail & Stepper */}
          <aside className="cp-card">
            {selectedReqDetail ? (
              <div>
                <div className="cp-card-header">
                  <h2><span>📋</span> Request Detail #{selectedReqDetail.bpmRequestId}</h2>
                  <span className={`cp-badge ${getBadgeClass(selectedReqDetail.status)}`}>
                    {formatStatus(selectedReqDetail.status)}
                  </span>
                </div>

                {/* Timeline Stepper */}
                <div className="cp-timeline">
                  <div className={`cp-step ${currentStage >= 1 ? 'done' : ''} ${currentStage === 1 ? 'active' : ''}`}>
                    <div className="cp-step-circle">1</div>
                    <span className="cp-step-label">Draft</span>
                  </div>
                  <div className={`cp-step ${currentStage >= 2 ? 'done' : ''} ${currentStage === 2 ? 'active' : ''}`}>
                    <div className="cp-step-circle">2</div>
                    <span className="cp-step-label">Submitted</span>
                  </div>
                  <div className={`cp-step ${currentStage >= 3 ? 'done' : ''} ${currentStage === 3 ? 'active' : ''}`}>
                    <div className="cp-step-circle">3</div>
                    <span className="cp-step-label">Assigned</span>
                  </div>
                  <div className={`cp-step ${currentStage >= 4 ? 'done' : ''} ${currentStage === 4 ? 'active' : ''}`}>
                    <div className="cp-step-circle">4</div>
                    <span className="cp-step-label">In Field</span>
                  </div>
                  <div className={`cp-step ${currentStage >= 5 ? 'done' : ''} ${currentStage === 5 ? 'active' : ''}`}>
                    <div className="cp-step-circle">5</div>
                    <span className="cp-step-label">Decision</span>
                  </div>
                </div>

                {/* Information block */}
                <div style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.88rem' }}>
                  <div>
                    <strong style={{ color: '#00236f' }}>Establishment: </strong>
                    <span>{selectedReqDetail.institution?.name || 'Not specified'}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#00236f' }}>Type: </strong>
                    <span>{selectedReqDetail.tipoEstablecimiento}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#00236f' }}>Inspection reason: </strong>
                    <p style={{ margin: '0.2rem 0', color: '#334155', background: '#f8fafc', padding: '0.5rem', borderRadius: '6px' }}>
                      {selectedReqDetail.motivo}
                    </p>
                  </div>
                  {selectedReqDetail.observaciones && (
                    <div>
                      <strong style={{ color: '#00236f' }}>Additional observations: </strong>
                      <p style={{ margin: '0.2rem 0', color: '#64748b' }}>
                        {selectedReqDetail.observaciones}
                      </p>
                    </div>
                  )}
                </div>

                {/* Document Attachments */}
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#00236f' }}>
                    📎 Required Health Documentation
                  </h3>
                  {selectedReqDetail.attachments && selectedReqDetail.attachments.length > 0 ? (
                    <div className="cp-attachments-list">
                      {selectedReqDetail.attachments.map((att: any) => (
                        <div key={att.attachmentId} className="cp-attachment-item">
                          <span>📄 {att.originalName || att.filename || `Attachment #${att.attachmentId}`}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {att.size ? `${Math.round(att.size / 1024)} KB` : 'Uploaded'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.82rem', color: '#64748b' }}>No documents attached yet.</p>
                  )}

                  {/* Add document form (when draft or in progress) */}
                  {selectedReqDetail.status === 'BORRADOR' && (
                    <form onSubmit={handleAddAttachment} style={{ marginTop: '0.85rem' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                        Attach supporting document:
                      </label>
                      <input
                        type="file"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        style={{ fontSize: '0.82rem' }}
                      />
                      {uploadFile && (
                        <button
                          type="submit"
                          disabled={submitting}
                          className="cp-btn-secondary"
                          style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
                        >
                          {submitting ? 'Uploading…' : '📤 Upload File'}
                        </button>
                      )}
                    </form>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {selectedReqDetail.status === 'BORRADOR' && (
                    <button
                      type="button"
                      disabled={submitting}
                      className="cp-btn-primary"
                      onClick={() => void handleSubmitRequest(selectedReqDetail.bpmRequestId)}
                    >
                      🚀 Submit for Health Evaluation
                    </button>
                  )}

                  {(selectedReqDetail.status === 'COMPLETADA' || selectedReqDetail.status === 'APROBADO') && (
                    <button
                      type="button"
                      className="cp-btn-primary"
                      style={{ background: '#047857' }}
                      onClick={() => {
                        const evalId = selectedReqDetail.evaluationId || evaluations[0]?.evaluationId || 1
                        if (onOpenOfficialReport) onOpenOfficialReport(evalId)
                        else notify(`Certificate for evaluation #${evalId}`)
                      }}
                    >
                      🎖 View Official Decision & BPM Certificate (PDF)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="cp-empty">
                <span>👈</span>
                <p>Select a request from the list to view its status and documentation.</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* 5. Tab 2: Mis Establecimientos & Representantes (RF-03) */}
      {activeTab === 'institutions' && (
        <div className="cp-card">
          <div className="cp-card-header">
            <h2><span>🏭</span> Registered Establishments ({institutions.length})</h2>
            <button
              type="button"
              className="cp-btn-primary"
              onClick={() => setShowNewInstitutionModal(true)}
            >
              ➕ Register New Establishment
            </button>
          </div>

          <div className="cp-help-box">
            <span>ℹ️</span>
            <div>
              Each establishment must have its geographic address, economic activity, and accredited representatives (Legal, Quality or Main Contact).
            </div>
          </div>

          {institutions.length === 0 ? (
            <div className="cp-empty">
              <span>🏢</span>
              <h3>No establishments registered</h3>
              <p>Register your processing plant, distribution center, or food service location.</p>
              <button
                type="button"
                className="cp-btn-primary"
                onClick={() => setShowNewInstitutionModal(true)}
              >
                Register Establishment
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {institutions.map((inst) => (
                <div key={inst.institutionId} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', background: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.05rem', color: '#00236f' }}>{inst.name}</h3>
                      <small style={{ color: '#64748b' }}>{inst.nombreComercial || 'Trade name not assigned'}</small>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="cp-badge cp-badge-assigned">RNC {inst.rnc}</span>
                      <button
                        type="button"
                        className="cp-btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                        onClick={() => {
                          setEditingInstitution(inst)
                          setShowEditInstitutionModal(true)
                        }}
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                    <div><strong>📍 Location:</strong> {inst.streetName ? `${inst.streetName} #${inst.streetNum || ''}` : 'Registered address'}</div>
                    <div><strong>🏭 Activity:</strong> {inst.actividadEconomica || 'Manufacturing / Food'}</div>
                    <div><strong>📞 Phone:</strong> {inst.phoneNumber || '—'}</div>
                    <div><strong>✉ Email:</strong> {inst.email || '—'}</div>
                  </div>

                  {/* Representatives Section */}
                  <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '0.82rem', color: '#00236f', textTransform: 'uppercase' }}>
                        👥 Accredited Representatives
                      </strong>
                      <button
                        type="button"
                        className="cp-btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                        onClick={() => {
                          setSelectedInstForRep(inst.institutionId)
                          setShowAddRepresentModal(true)
                        }}
                      >
                        ➕ Add
                      </button>
                    </div>

                    {inst.represents && inst.represents.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {inst.represents.map((rep: any) => (
                          <div key={rep.representId} style={{ background: '#f8fafc', padding: '0.45rem 0.65rem', borderRadius: '6px', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between' }}>
                            <span><strong>{rep.person?.name || 'Representative'}</strong> ({rep.type || rep.tipo})</span>
                            <span style={{ color: '#00236f', fontWeight: 600 }}>{rep.type || rep.tipo}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                        No representatives registered. Add a Quality or Legal contact.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Tab 3: Official Decisions & Health Certificates */}
      {activeTab === 'evaluations' && (
        <div className="cp-card">
          <div className="cp-card-header">
            <h2><span>🎖</span> Official Decisions & Health Certificates</h2>
            <button
              type="button"
              className="cp-btn-secondary"
              onClick={() => void loadData()}
            >
              🔄 Refresh
            </button>
          </div>

          <div className="cp-help-box">
            <span>🛡️</span>
            <div>
              <strong>Legal Validity of Reports:</strong> Certificates issued correspond to closed evaluations with a passing decision from the Health Coordinator. You can view or download them in official PDF format at any time.
            </div>
          </div>

          {evaluations.length === 0 ? (
            <div className="cp-empty">
              <span>📑</span>
              <h3>No completed evaluations to display</h3>
              <p>Once the field technician completes the inspection and the coordinator approves it, your certificates will appear here.</p>
            </div>
          ) : (
            <table className="cp-table-simple">
              <thead>
                <tr>
                  <th>Evaluation #</th>
                  <th>Establishment</th>
                  <th>Date</th>
                  <th>Risk Level (EBR)</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((ev) => (
                  <tr key={ev.evaluationId}>
                    <td><strong>#{ev.evaluationId}</strong></td>
                    <td>{ev.institution?.name || 'Establishment'}</td>
                    <td>{new Date(ev.scheduledDate).toLocaleDateString('es-DO')}</td>
                    <td>
                      <span className={`cp-badge ${ev.priority === 'ALTA' ? 'cp-badge-rejected' : 'cp-badge-done'}`}>
                        {ev.priority || 'LOW RISK'}
                      </span>
                    </td>
                    <td>
                      <span className={`cp-badge ${getBadgeClass(ev.status)}`}>
                        {formatStatus(ev.status)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="cp-btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#00236f', fontWeight: 700 }}
                        onClick={() => {
                          if (onOpenOfficialReport) onOpenOfficialReport(ev.evaluationId)
                          else notify(`Opening certificate #${ev.evaluationId}`)
                        }}
                      >
                        📄 View Official Certificate (PDF)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal 1: Nueva Solicitud BPM */}
      {showNewRequestModal && (
        <div className="cp-modal-backdrop" onClick={() => setShowNewRequestModal(false)}>
          <div className="cp-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-header">
              <h2><span>➕</span> New BPM Evaluation Request</h2>
              <button
                type="button"
                className="cp-modal-close"
                onClick={() => setShowNewRequestModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateRequest}>
              <div className="cp-modal-body cp-form">
                <div className="cp-help-box" style={{ margin: 0 }}>
                  <span>ℹ️</span>
                  <span>Requests initiated by the company create a case with initial status Draft or Pending Assignment for technical review.</span>
                </div>

                <label>
                  Requesting establishment *
                  <select name="institutionId" required defaultValue={institutions[0]?.institutionId || ''}>
                    <option value="">Select your plant or location...</option>
                    {institutions.map((i) => (
                      <option key={i.institutionId} value={i.institutionId}>
                        {i.name} — RNC: {i.rnc}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="cp-form-row">
                  <label>
                    Establishment type *
                    <input
                      name="tipoEstablecimiento"
                      required
                      placeholder="e.g. Dairy processing plant, Industrial bakery"
                    />
                  </label>
                  <label>
                    Submission mode
                    <select name="submitDirectly" defaultValue="true">
                      <option value="true">Submit directly for evaluation</option>
                      <option value="false">Save as draft only</option>
                    </select>
                  </label>
                </div>

                <label>
                  Request reason *
                  <textarea
                    name="motivo"
                    required
                    placeholder="Specify the objective: Permit renewal, Annual BPM certification, production line expansion..."
                  />
                </label>

                <label>
                  Technical observations (optional)
                  <textarea
                    name="observaciones"
                    placeholder="Operating shifts, availability, or special considerations for the evaluator..."
                  />
                </label>

                <label>
                  Required health document (Authorization letter / Commercial registry)
                  <input
                    type="file"
                    name="attachment"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  />
                </label>
              </div>

              <div className="cp-modal-footer">
                <button
                  type="button"
                  className="cp-btn-secondary"
                  onClick={() => setShowNewRequestModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cp-btn-primary"
                >
                  {submitting ? 'Processing…' : 'Create Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Registrar Establecimiento (RF-03) */}
      {showNewInstitutionModal && (
        <div className="cp-modal-backdrop" onClick={() => setShowNewInstitutionModal(false)}>
          <div className="cp-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-header">
              <h2><span>🏭</span> Register Establishment</h2>
              <button
                type="button"
                className="cp-modal-close"
                onClick={() => setShowNewInstitutionModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateInstitution}>
              <div className="cp-modal-body cp-form">
                {instFormError && <div style={{padding:'0.6rem 0.85rem',background:'#fff0f0',border:'1px solid #fca5a5',borderRadius:'6px',color:'#b91c1c',fontSize:'0.82rem',marginBottom:'0.75rem'}}>{instFormError}</div>}
                <div className="cp-form-row">
                  <label>
                    Legal Company Name *
                    <input name="name" required placeholder="Legal entity name" />
                  </label>
                  <label>
                    Trade Name
                    <input name="nombreComercial" placeholder="Visible trade name" />
                  </label>
                </div>

                <div className="cp-form-row">
                  <label>
                    RNC *
                    <input name="rnc" required placeholder="e.g. 1301234567" onKeyDown={(e) => {
                      if (!/[0-9\-]/.test(e.key) && !['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Enter'].includes(e.key)) {
                        e.preventDefault()
                      }
                    }} inputMode="numeric" />
                  </label>
                  <label>
                    Economic Activity *
                    <input name="actividadEconomica" required placeholder="e.g. Meat processing" />
                  </label>
                </div>

                <div className="cp-form-row">
                  <label>
                    Province *
                    <select
                      required
                      value={selectedProvinceId}
                      onChange={(e) => void handleProvinceChange(e.target.value)}
                    >
                      <option value="">Select province...</option>
                      {provinces.map((p) => (
                        <option key={p.provinceId} value={p.provinceId}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Municipality *
                    <select name="municipalityId" required disabled={!selectedProvinceId}>
                      <option value="">Select municipality...</option>
                      {municipalities.map((m) => (
                        <option key={m.municipalityId} value={m.municipalityId}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="cp-form-row">
                  <label>
                    Street / Avenue *
                    <input name="streetName" required placeholder="e.g. Av. 27 de Febrero" />
                  </label>
                  <label>
                    Street Number
                    <input name="streetNum" placeholder="e.g. 42-B" />
                  </label>
                </div>

                <div className="cp-form-row">
                  <label>
                    Phone *
                    <input name="phoneNumber" required placeholder="e.g. 809-555-1234" />
                  </label>
                  <label>
                    Email *
                    <input type="email" name="email" required placeholder="quality@company.com" />
                  </label>
                </div>
              </div>

              <div className="cp-modal-footer">
                <button
                  type="button"
                  className="cp-btn-secondary"
                  onClick={() => setShowNewInstitutionModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cp-btn-primary"
                >
                  {submitting ? 'Registering…' : 'Register Establishment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Añadir Representante (RF-03) */}
      {showAddRepresentModal && (
        <div className="cp-modal-backdrop" onClick={() => setShowAddRepresentModal(false)}>
          <div className="cp-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-header">
              <h2><span>👥</span> Add Accredited Representative</h2>
              <button
                type="button"
                className="cp-modal-close"
                onClick={() => setShowAddRepresentModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddRepresentative}>
              <div className="cp-modal-body cp-form">
                {repFormError && <div style={{padding:'0.6rem 0.85rem',background:'#fff0f0',border:'1px solid #fca5a5',borderRadius:'6px',color:'#b91c1c',fontSize:'0.82rem',marginBottom:'0.75rem'}}>{repFormError}</div>}
                <label>
                  Representative Type *
                  <select name="tipo" defaultValue="CALIDAD">
                    <option value="CALIDAD">Quality / Food Safety Manager</option>
                    <option value="LEGAL">Legal Representative</option>
                    <option value="CONTACTO_PRINCIPAL">Main Operational Contact</option>
                  </select>
                </label>

                <div className="cp-form-row">
                  <label>
                    Full Name *
                    <input name="name" required placeholder="e.g. Dr. Carmen Santos" />
                  </label>
                  <label>
                    National ID / Document *
                    <input name="cedula" required placeholder="e.g. 001-1234567-8" />
                  </label>
                </div>

                <div className="cp-form-row">
                  <label>
                    Email *
                    <input type="email" name="email" required placeholder="csantos@empresa.com" />
                  </label>
                  <label>
                    Phone *
                    <input name="phone" required placeholder="e.g. 809-555-8899" />
                  </label>
                </div>

                <label>
                  Position in Company
                  <input name="cargo" placeholder="e.g. Quality Assurance Manager" />
                </label>
              </div>

              <div className="cp-modal-footer">
                <button
                  type="button"
                  className="cp-btn-secondary"
                  onClick={() => setShowAddRepresentModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cp-btn-primary"
                >
                  {submitting ? 'Saving…' : 'Assign Representative'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Edit Institution */}
      {showEditInstitutionModal && editingInstitution && (
        <div className="cp-modal-backdrop" onClick={() => setShowEditInstitutionModal(false)}>
          <div className="cp-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-header">
              <h2><span>✏️</span> Edit Establishment</h2>
              <button type="button" className="cp-modal-close" onClick={() => setShowEditInstitutionModal(false)}>×</button>
            </div>
            <form onSubmit={handleEditInstitution}>
              <div className="cp-modal-body cp-form">
                {editFormError && <div style={{padding:'0.6rem 0.85rem',background:'#fff0f0',border:'1px solid #fca5a5',borderRadius:'6px',color:'#b91c1c',fontSize:'0.82rem',marginBottom:'0.75rem'}}>{editFormError}</div>}
                <div className="cp-form-row">
                  <label>Legal Company Name *<input name="name" required defaultValue={editingInstitution.name} /></label>
                  <label>Trade Name<input name="nombreComercial" defaultValue={editingInstitution.nombreComercial || ''} /></label>
                </div>
                <div className="cp-form-row">
                  <label>RNC *<input name="rnc" required defaultValue={editingInstitution.rnc} onKeyDown={(e) => { if (!/[0-9\-]/.test(e.key) && !['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Enter'].includes(e.key)) e.preventDefault() }} inputMode="numeric" /></label>
                  <label>Economic Activity<input name="actividadEconomica" defaultValue={editingInstitution.actividadEconomica || ''} /></label>
                </div>
                <div className="cp-form-row">
                  <label>Street / Avenue *<input name="streetName" required defaultValue={editingInstitution.streetName || ''} /></label>
                  <label>Street Number<input name="streetNum" defaultValue={editingInstitution.streetNum || ''} /></label>
                </div>
                <div className="cp-form-row">
                  <label>Phone *<input name="phoneNumber" required defaultValue={editingInstitution.phoneNumber || ''} /></label>
                  <label>Email *<input type="email" name="email" required defaultValue={editingInstitution.email || ''} /></label>
                </div>
              </div>
              <div className="cp-modal-footer">
                <button type="button" className="cp-btn-secondary" onClick={() => setShowEditInstitutionModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="cp-btn-primary">{submitting ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
