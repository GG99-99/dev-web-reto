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
    if (!confirm('¿Desea enviar formalmente esta solicitud de evaluación BPM a la autoridad sanitaria?')) return
    setSubmitting(true)
    try {
      const res = await bpmRequestsService.submit(id)
      if (res.valid) {
        notify(`¡Solicitud #${id} enviada con éxito! Se ha originado el Caso #${res.data?.case?.caseId ?? ''} para evaluación.`)
        await loadData()
      }
    } catch (err: any) {
      notify(err?.response?.data?.message || 'No se pudo enviar la solicitud.')
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
        notify('Documento adjunto registrado correctamente.')
        setUploadFile(null)
        // Refresh request detail
        const detailRes = await bpmRequestsService.getById(selectedRequestId)
        if (detailRes.valid) setSelectedReqDetail(detailRes.data)
      }
    } catch (err: any) {
      notify(err?.response?.data?.message || 'Error al adjuntar documento.')
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
      notify('Por favor complete los campos obligatorios.')
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
            notify('Solicitud creada, pero hubo un error al cargar el archivo adjunto.')
          }
        }

        if (submitDirectly) {
          try {
            await bpmRequestsService.submit(newId)
            notify(`Solicitud BPM #${newId} creada y enviada a revisión técnica.`)
          } catch {
            notify(`Solicitud BPM #${newId} guardada como borrador (no se pudo enviar automáticamente).`)
          }
        } else {
          notify(`Solicitud BPM #${newId} guardada como borrador.`)
        }

        setShowNewRequestModal(false)
        await loadData()
        setSelectedRequestId(newId)
      }
    } catch (err: any) {
      notify(err?.response?.data?.message || 'Error al crear la solicitud BPM.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Register Institution
  const handleCreateInstitution = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
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
        notify(`Establecimiento "${res.data.name}" registrado correctamente.`)
        setShowNewInstitutionModal(false)
        await loadData()
      }
    } catch (err: any) {
      notify(err?.response?.data?.message || 'Error al registrar establecimiento.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Add Representative
  const handleAddRepresentative = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedInstForRep) return
    const form = new FormData(e.currentTarget)
    const body = {
      tipo: String(form.get('tipo') || 'CALIDAD') as 'LEGAL' | 'CALIDAD' | 'CONTACTO_PRINCIPAL',
      person: {
        name: String(form.get('name') || ''),
        email: String(form.get('email') || ''),
        phone: String(form.get('phone') || ''),
        cedula: String(form.get('cedula') || ''),
      },
      cargo: String(form.get('cargo') || ''),
    }

    setSubmitting(true)
    try {
      const res = await institutionsService.addRepresentative(selectedInstForRep, body)
      if (res.valid) {
        notify('Representante institucional asignado con éxito.')
        setShowAddRepresentModal(false)
        await loadData()
      }
    } catch (err: any) {
      notify(err?.response?.data?.message || 'Error al agregar representante.')
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
    return st.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return (
    <section className="company-portal">
      {/* 1. Header Hero Banner */}
      <div className="cp-hero">
        <div className="cp-hero-info">
          <small>Portal del Establecimiento Regulado · BPM</small>
          <h1>{mainInstitution?.name || 'Portal de Autogestión de la Empresa'}</h1>
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
            ➕ Nueva Solicitud BPM
          </button>
          <button
            type="button"
            className="cp-btn-white"
            style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
            onClick={() => setShowNewInstitutionModal(true)}
          >
            🏭 Registrar Planta / Local
          </button>
        </div>
      </div>

      {/* 2. Metrics Row */}
      <div className="cp-metrics-row">
        <div className="cp-metric-card">
          <div className="cp-metric-icon cp-icon-blue">📋</div>
          <div className="cp-metric-text">
            <span className="cp-metric-label">Total Solicitudes</span>
            <span className="cp-metric-val">{metrics.totalRequests}</span>
          </div>
        </div>
        <div className="cp-metric-card">
          <div className="cp-metric-icon cp-icon-amber">⏳</div>
          <div className="cp-metric-text">
            <span className="cp-metric-label">En Evaluación / Asignadas</span>
            <span className="cp-metric-val">{metrics.inProgress}</span>
          </div>
        </div>
        <div className="cp-metric-card">
          <div className="cp-metric-icon cp-icon-purple">📝</div>
          <div className="cp-metric-text">
            <span className="cp-metric-label">Borradores Pendientes</span>
            <span className="cp-metric-val">{metrics.drafts}</span>
          </div>
        </div>
        <div className="cp-metric-card">
          <div className="cp-metric-icon cp-icon-green">🛡</div>
          <div className="cp-metric-text">
            <span className="cp-metric-label">Dictámenes Completados</span>
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
          📄 Mis Solicitudes BPM
        </button>
        <button
          type="button"
          className={`cp-tab-btn ${activeTab === 'institutions' ? 'active' : ''}`}
          onClick={() => setActiveTab('institutions')}
        >
          🏢 Establecimientos & Representantes (RF-03)
        </button>
        <button
          type="button"
          className={`cp-tab-btn ${activeTab === 'evaluations' ? 'active' : ''}`}
          onClick={() => setActiveTab('evaluations')}
        >
          🎖 Certificados Sanitarios & Evaluaciones
        </button>
      </div>

      {/* 4. Tab 1: Mis Solicitudes BPM */}
      {activeTab === 'requests' && (
        <div className="cp-content-grid">
          {/* Left: Requests List */}
          <div className="cp-card">
            <div className="cp-card-header">
              <h2><span>🗂</span> Trámites Registrados ({requests.length})</h2>
              <button
                type="button"
                className="cp-btn-secondary"
                onClick={() => void loadData()}
              >
                🔄 Actualizar
              </button>
            </div>

            {loading ? (
              <div className="cp-empty"><span>⏳</span><p>Cargando solicitudes BPM de la empresa…</p></div>
            ) : requests.length === 0 ? (
              <div className="cp-empty">
                <span>📂</span>
                <h3>Sin solicitudes registradas</h3>
                <p>Inicie un trámite de evaluación basada en riesgo para sus instalaciones alimentarias.</p>
                <button
                  type="button"
                  className="cp-btn-primary"
                  onClick={() => setShowNewRequestModal(true)}
                >
                  ➕ Crear primera solicitud BPM
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
                        <strong>{req.institution?.name || 'Establecimiento'}</strong>
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
                  <h2><span>📋</span> Detalle de Solicitud #{selectedReqDetail.bpmRequestId}</h2>
                  <span className={`cp-badge ${getBadgeClass(selectedReqDetail.status)}`}>
                    {formatStatus(selectedReqDetail.status)}
                  </span>
                </div>

                {/* Timeline Stepper */}
                <div className="cp-timeline">
                  <div className={`cp-step ${currentStage >= 1 ? 'done' : ''} ${currentStage === 1 ? 'active' : ''}`}>
                    <div className="cp-step-circle">1</div>
                    <span className="cp-step-label">Borrador</span>
                  </div>
                  <div className={`cp-step ${currentStage >= 2 ? 'done' : ''} ${currentStage === 2 ? 'active' : ''}`}>
                    <div className="cp-step-circle">2</div>
                    <span className="cp-step-label">Enviado</span>
                  </div>
                  <div className={`cp-step ${currentStage >= 3 ? 'done' : ''} ${currentStage === 3 ? 'active' : ''}`}>
                    <div className="cp-step-circle">3</div>
                    <span className="cp-step-label">Asignado</span>
                  </div>
                  <div className={`cp-step ${currentStage >= 4 ? 'done' : ''} ${currentStage === 4 ? 'active' : ''}`}>
                    <div className="cp-step-circle">4</div>
                    <span className="cp-step-label">En Campo</span>
                  </div>
                  <div className={`cp-step ${currentStage >= 5 ? 'done' : ''} ${currentStage === 5 ? 'active' : ''}`}>
                    <div className="cp-step-circle">5</div>
                    <span className="cp-step-label">Dictamen</span>
                  </div>
                </div>

                {/* Information block */}
                <div style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.88rem' }}>
                  <div>
                    <strong style={{ color: '#00236f' }}>Establecimiento: </strong>
                    <span>{selectedReqDetail.institution?.name || 'No especificado'}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#00236f' }}>Tipo: </strong>
                    <span>{selectedReqDetail.tipoEstablecimiento}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#00236f' }}>Motivo de inspección: </strong>
                    <p style={{ margin: '0.2rem 0', color: '#334155', background: '#f8fafc', padding: '0.5rem', borderRadius: '6px' }}>
                      {selectedReqDetail.motivo}
                    </p>
                  </div>
                  {selectedReqDetail.observaciones && (
                    <div>
                      <strong style={{ color: '#00236f' }}>Observaciones adicionales: </strong>
                      <p style={{ margin: '0.2rem 0', color: '#64748b' }}>
                        {selectedReqDetail.observaciones}
                      </p>
                    </div>
                  )}
                </div>

                {/* Document Attachments */}
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#00236f' }}>
                    📎 Documentación Sanitaria Obligatoria
                  </h3>
                  {selectedReqDetail.attachments && selectedReqDetail.attachments.length > 0 ? (
                    <div className="cp-attachments-list">
                      {selectedReqDetail.attachments.map((att: any) => (
                        <div key={att.attachmentId} className="cp-attachment-item">
                          <span>📄 {att.originalName || att.filename || `Adjunto #${att.attachmentId}`}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {att.size ? `${Math.round(att.size / 1024)} KB` : 'Cargado'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.82rem', color: '#64748b' }}>No se han adjuntado documentos aún.</p>
                  )}

                  {/* Add document form (when draft or in progress) */}
                  {selectedReqDetail.status === 'BORRADOR' && (
                    <form onSubmit={handleAddAttachment} style={{ marginTop: '0.85rem' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                        Adjuntar documento complementario:
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
                          {submitting ? 'Subiendo…' : '📤 Subir Archivo'}
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
                      🚀 Enviar a Evaluación Sanitaria
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
                        else notify(`Dictamen para evaluación #${evalId}`)
                      }}
                    >
                      🎖 Ver Dictamen Oficial & Certificado BPM (PDF)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="cp-empty">
                <span>👈</span>
                <p>Seleccione una solicitud de la lista para ver su estado y documentación.</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* 5. Tab 2: Mis Establecimientos & Representantes (RF-03) */}
      {activeTab === 'institutions' && (
        <div className="cp-card">
          <div className="cp-card-header">
            <h2><span>🏭</span> Establecimientos Registrados ({institutions.length})</h2>
            <button
              type="button"
              className="cp-btn-primary"
              onClick={() => setShowNewInstitutionModal(true)}
            >
              ➕ Registrar Nuevo Establecimiento
            </button>
          </div>

          <div className="cp-help-box">
            <span>ℹ️</span>
            <div>
              <strong>Requisito RF-03 (Gestión de Empresas):</strong> Cada establecimiento debe contar con su dirección geográfica, actividad económica y representantes acreditados (Legal, Calidad o Contacto Principal).
            </div>
          </div>

          {institutions.length === 0 ? (
            <div className="cp-empty">
              <span>🏢</span>
              <h3>No tiene establecimientos registrados</h3>
              <p>Registre su planta de procesamiento, centro de distribución o local gastronómico.</p>
              <button
                type="button"
                className="cp-btn-primary"
                onClick={() => setShowNewInstitutionModal(true)}
              >
                Registrar Establecimiento
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {institutions.map((inst) => (
                <div key={inst.institutionId} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', background: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.05rem', color: '#00236f' }}>{inst.name}</h3>
                      <small style={{ color: '#64748b' }}>{inst.nombreComercial || 'Nombre comercial no asignado'}</small>
                    </div>
                    <span className="cp-badge cp-badge-assigned">RNC {inst.rnc}</span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                    <div><strong>📍 Ubicación:</strong> {inst.streetName ? `${inst.streetName} #${inst.streetNum || ''}` : 'Dirección registrada'}</div>
                    <div><strong>🏭 Actividad:</strong> {inst.actividadEconomica || 'Fabricación / Alimentos'}</div>
                    <div><strong>📞 Teléfono:</strong> {inst.phoneNumber || '—'}</div>
                    <div><strong>✉ Correo:</strong> {inst.email || '—'}</div>
                  </div>

                  {/* Representatives Section */}
                  <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '0.82rem', color: '#00236f', textTransform: 'uppercase' }}>
                        👥 Representantes Acreditados
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
                        ➕ Añadir
                      </button>
                    </div>

                    {inst.represents && inst.represents.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {inst.represents.map((rep: any) => (
                          <div key={rep.representId} style={{ background: '#f8fafc', padding: '0.45rem 0.65rem', borderRadius: '6px', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between' }}>
                            <span><strong>{rep.person?.name || 'Representante'}</strong> ({rep.cargo || rep.tipo})</span>
                            <span style={{ color: '#00236f', fontWeight: 600 }}>{rep.tipo}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                        Sin representantes registrados. Añada el contacto de Calidad o Legal.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Tab 3: Certificados Sanitarios & Evaluaciones (RF-19 / RF-20) */}
      {activeTab === 'evaluations' && (
        <div className="cp-card">
          <div className="cp-card-header">
            <h2><span>🎖</span> Dictámenes Oficiales & Certificados Sanitarios</h2>
            <button
              type="button"
              className="cp-btn-secondary"
              onClick={() => void loadData()}
            >
              🔄 Actualizar
            </button>
          </div>

          <div className="cp-help-box">
            <span>🛡️</span>
            <div>
              <strong>Validez Legal de Informes:</strong> Los certificados emitidos corresponden a evaluaciones cerradas con dictamen aprobatorio del Coordinador Sanitario. Puede consultarlos o descargarlos en formato oficial PDF en cualquier momento.
            </div>
          </div>

          {evaluations.length === 0 ? (
            <div className="cp-empty">
              <span>📑</span>
              <h3>No hay evaluaciones concluidas para mostrar</h3>
              <p>Una vez que el técnico complete la inspección en campo y el coordinador la apruebe, sus actas aparecerán aquí.</p>
            </div>
          ) : (
            <table className="cp-table-simple">
              <thead>
                <tr>
                  <th>No. Evaluación</th>
                  <th>Establecimiento</th>
                  <th>Fecha</th>
                  <th>Nivel de Riesgo (EBR)</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((ev) => (
                  <tr key={ev.evaluationId}>
                    <td><strong>#{ev.evaluationId}</strong></td>
                    <td>{ev.institution?.name || 'Establecimiento'}</td>
                    <td>{new Date(ev.scheduledDate).toLocaleDateString('es-DO')}</td>
                    <td>
                      <span className={`cp-badge ${ev.priority === 'ALTA' ? 'cp-badge-rejected' : 'cp-badge-done'}`}>
                        {ev.priority || 'BAJO RIESGO'}
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
                          else notify(`Abriendo dictamen #${ev.evaluationId}`)
                        }}
                      >
                        📄 Ver Certificado Oficial (PDF)
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
              <h2><span>➕</span> Nueva Solicitud de Evaluación BPM (RF-05)</h2>
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
                  <span>Las solicitudes iniciadas por la empresa originan un expediente con estatus inicial <em>Borrador</em> o <em>Pendiente de Asignación</em> para revisión técnica.</span>
                </div>

                <label>
                  Establecimiento solicitante *
                  <select name="institutionId" required defaultValue={institutions[0]?.institutionId || ''}>
                    <option value="">Seleccione su planta o local...</option>
                    {institutions.map((i) => (
                      <option key={i.institutionId} value={i.institutionId}>
                        {i.name} — RNC: {i.rnc}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="cp-form-row">
                  <label>
                    Tipo de establecimiento *
                    <input
                      name="tipoEstablecimiento"
                      required
                      placeholder="Ej: Planta procesadora de lácteos, Panadería industrial"
                    />
                  </label>
                  <label>
                    Envío del trámite
                    <select name="submitDirectly" defaultValue="true">
                      <option value="true">Enviar directamente a evaluación</option>
                      <option value="false">Guardar solo como borrador</option>
                    </select>
                  </label>
                </div>

                <label>
                  Motivo de la solicitud *
                  <textarea
                    name="motivo"
                    required
                    placeholder="Especifique el objetivo: Renovación de permiso sanitario, Certificación BPM anual, ampliación de línea de producción..."
                  />
                </label>

                <label>
                  Observaciones técnicas (opcional)
                  <textarea
                    name="observaciones"
                    placeholder="Turnos de operación, disponibilidad horaria o consideraciones especiales para la visita del técnico evaluador..."
                  />
                </label>

                <label>
                  Documento sanitario obligatorio (Carta solicitud / Registro mercantil)
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
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cp-btn-primary"
                >
                  {submitting ? 'Procesando…' : 'Crear Solicitud'}
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
              <h2><span>🏭</span> Registrar Establecimiento (RF-03)</h2>
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
                <div className="cp-form-row">
                  <label>
                    Razón Social *
                    <input name="name" required placeholder="Nombre legal de la entidad" />
                  </label>
                  <label>
                    Nombre Comercial
                    <input name="nombreComercial" placeholder="Nombre comercial visible" />
                  </label>
                </div>

                <div className="cp-form-row">
                  <label>
                    RNC *
                    <input name="rnc" required placeholder="Ej: 130123456" />
                  </label>
                  <label>
                    Actividad Económica *
                    <input name="actividadEconomica" required placeholder="Ej: Procesamiento cárnico" />
                  </label>
                </div>

                <div className="cp-form-row">
                  <label>
                    Provincia *
                    <select
                      required
                      value={selectedProvinceId}
                      onChange={(e) => void handleProvinceChange(e.target.value)}
                    >
                      <option value="">Seleccione provincia...</option>
                      {provinces.map((p) => (
                        <option key={p.provinceId} value={p.provinceId}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Municipio *
                    <select name="municipalityId" required disabled={!selectedProvinceId}>
                      <option value="">Seleccione municipio...</option>
                      {municipalities.map((m) => (
                        <option key={m.municipalityId} value={m.municipalityId}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="cp-form-row">
                  <label>
                    Calle / Avenida *
                    <input name="streetName" required placeholder="Ej: Av. 27 de Febrero" />
                  </label>
                  <label>
                    Número
                    <input name="streetNum" placeholder="Ej: 42-B" />
                  </label>
                </div>

                <div className="cp-form-row">
                  <label>
                    Teléfono *
                    <input name="phoneNumber" required placeholder="Ej: 809-555-1234" />
                  </label>
                  <label>
                    Correo Electrónico *
                    <input type="email" name="email" required placeholder="calidad@empresa.com.do" />
                  </label>
                </div>
              </div>

              <div className="cp-modal-footer">
                <button
                  type="button"
                  className="cp-btn-secondary"
                  onClick={() => setShowNewInstitutionModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cp-btn-primary"
                >
                  {submitting ? 'Registrando…' : 'Registrar Establecimiento'}
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
              <h2><span>👥</span> Añadir Representante Acreditado</h2>
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
                <label>
                  Tipo de Representación *
                  <select name="tipo" defaultValue="CALIDAD">
                    <option value="CALIDAD">Responsable de Calidad / Inocuidad</option>
                    <option value="LEGAL">Representante Legal</option>
                    <option value="CONTACTO_PRINCIPAL">Contacto Operativo Principal</option>
                  </select>
                </label>

                <div className="cp-form-row">
                  <label>
                    Nombre Completo *
                    <input name="name" required placeholder="Ej: Dra. Carmen Santos" />
                  </label>
                  <label>
                    Cédula / Documento *
                    <input name="cedula" required placeholder="Ej: 001-1234567-8" />
                  </label>
                </div>

                <div className="cp-form-row">
                  <label>
                    Correo Electrónico *
                    <input type="email" name="email" required placeholder="csantos@empresa.com" />
                  </label>
                  <label>
                    Teléfono *
                    <input name="phone" required placeholder="Ej: 809-555-8899" />
                  </label>
                </div>

                <label>
                  Cargo en la Empresa *
                  <input name="cargo" required placeholder="Ej: Gerente de Aseguramiento de Calidad" />
                </label>
              </div>

              <div className="cp-modal-footer">
                <button
                  type="button"
                  className="cp-btn-secondary"
                  onClick={() => setShowAddRepresentModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cp-btn-primary"
                >
                  {submitting ? 'Guardando…' : 'Asignar Representante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
