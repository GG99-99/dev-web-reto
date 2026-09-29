// @ts-nocheck
import { useState, useEffect, useMemo, FormEvent } from 'react'
import {
  bpmRequestsService,
  institutionsService,
  evaluationsService,
  dashboardService,
} from './services'
import { pickCurrentEvaluation } from '@reto/shared'
import {
  evaluationLifecycle,
  isDoneLifecycle,
  isOpenLifecycle,
  lifecycleStage,
  requestLifecycle,
  statusLabel,
} from './statusLabels'
import './CompanyPortal.css'
import {
  allowFormattedKey,
  formatNationalId,
  formatPhoneInput,
  formatRnc,
  formatStreetNumber,
  isValidEmail,
  isValidNationalId,
  isValidPersonName,
  isValidPhone,
  isValidRnc,
  isValidStreetNumber,
} from './inputFormat'

type Role = 'ADMIN' | 'ADMIN_EMPRESA' | 'USUARIO_DELEGADO' | 'COORDINADOR' | 'TECNICO_EVALUADOR'

interface CompanyPortalProps {
  role: Role
  notify: (msg: string) => void
  onOpenOfficialReport?: (evaluationId: number) => void
}

type TabKey = 'requests' | 'institutions' | 'evaluations'

function apiErrorMessage(err: any, fallback: string): string {
  const apiErr = err?.response?.data?.error
  const fieldErrors = apiErr?.details?.fieldErrors
  if (fieldErrors && typeof fieldErrors === 'object') {
    const parts = Object.entries(fieldErrors).flatMap(([field, messages]) => {
      const list = Array.isArray(messages) ? messages : []
      return list.map((message) => `${field}: ${message}`)
    })
    if (parts.length) return parts.join('; ')
  }
  if (typeof apiErr === 'string' && apiErr) return apiErr
  if (apiErr?.message) return String(apiErr.message)
  if (err?.response?.data?.message) return String(err.response.data.message)
  return fallback
}

function maskedChange(format: (value: string) => string) {
  return (event: { currentTarget: HTMLInputElement }) => {
    event.currentTarget.value = format(event.currentTarget.value)
  }
}

function validateEstablishment(body: {
  name: string
  rnc: string
  actividadEconomica?: string
  streetName: string
  streetNum?: string
  phoneNumber: string
  email: string
}, requireActivity: boolean) {
  if (!isValidPersonName(body.name)) return 'Enter the legal company name.'
  if (!isValidRnc(body.rnc)) return 'RNC must be exactly 9 digits.'
  if (requireActivity && !body.actividadEconomica) return 'Enter the economic activity.'
  if (body.actividadEconomica && body.actividadEconomica.trim().length < 2) return 'Enter the economic activity.'
  if (!body.streetName || body.streetName.trim().length < 2) return 'Enter the street or avenue.'
  if (!isValidStreetNumber(body.streetNum || '')) return 'Street number must contain digits only.'
  if (!isValidPhone(body.phoneNumber)) return 'Enter a valid phone number, such as (809) 555-0101 or +44 20 7946 0958.'
  if (!isValidEmail(body.email)) return 'Enter a valid email address.'
  return ''
}

function buildStatusHistory(request: any) {
  const events: { at: number; label: string }[] = []
  const push = (at: unknown, label: string) => {
    if (!at) return
    const time = new Date(at as string).getTime()
    if (Number.isNaN(time)) return
    events.push({ at: time, label })
  }

  push(request?.createdAt, 'Draft created')
  push(request?.sentAt, 'Submitted — pending assignment')

  for (const assignment of request?.case?.assignments ?? []) {
    const name = assignment?.assignedTo?.person?.name
    push(assignment?.assignedAt, name ? `Evaluator assigned: ${name}` : 'Evaluator assigned')
  }

  const evaluations = [...(request?.case?.evaluations ?? [])].sort(
    (a, b) => new Date(a?.createdAt ?? 0).getTime() - new Date(b?.createdAt ?? 0).getTime(),
  )
  for (const evaluation of evaluations) {
    if (evaluation?.status === 'CANCELADA') {
      push(evaluation.createdAt, `Evaluation #${evaluation.evaluationId} cancelled`)
      continue
    }
    push(evaluation?.createdAt, `Evaluation #${evaluation.evaluationId} scheduled`)
    push(evaluation?.startedAt, 'Evaluation underway')
    push(evaluation?.finishedAt, 'Evaluation completed')
    const reviews = [...(evaluation?.report?.reviews ?? [])].sort(
      (a, b) => new Date(a?.reviewedAt ?? 0).getTime() - new Date(b?.reviewedAt ?? 0).getTime(),
    )
    if (evaluation?.report && evaluation.report.status !== 'BORRADOR') {
      const anchor = reviews[0]?.reviewedAt
        ? new Date(new Date(reviews[0].reviewedAt).getTime() - 1).toISOString()
        : evaluation.finishedAt
      push(anchor, 'Submitted for review')
    }
    for (const review of reviews) {
      const action = review?.action
      const label = action === 'APROBAR'
        ? 'Coordinator approved the evaluation'
        : action === 'SOLICITAR_CORRECCION' || action === 'DEVOLVER'
          ? 'Returned for correction'
          : `Review recorded${action ? `: ${statusLabel(action)}` : ''}`
      push(review?.reviewedAt, label)
    }
  }

  push(request?.case?.closedAt, 'Case closed')
  events.sort((a, b) => a.at - b.at)
  return events.filter((event, index) => (
    index === 0 || event.at !== events[index - 1].at || event.label !== events[index - 1].label
  ))
}

function StatusHistory({ request }: { request: any }) {
  const events = buildStatusHistory(request)
  if (!events.length) return null
  return (
    <div style={{ marginTop: '1.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#00236f' }}>
        Status history
      </h3>
      <ol style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {events.map((event) => (
          <li key={`${event.at}-${event.label}`} style={{ fontSize: '0.82rem', color: '#334155' }}>
            <strong>{event.label}</strong>
            <span style={{ color: '#64748b' }}> · {new Date(event.at).toLocaleString('en-US')}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function representativeRole(type?: string) {
  if (type === 'LEGAL') return 'Legal Representative'
  if (type === 'CALIDAD') return 'Quality / Food Safety Manager'
  if (type === 'CONTACTO') return 'Main Operational Contact'
  return type || 'Representative'
}

export default function CompanyPortal({ role, notify, onOpenOfficialReport }: CompanyPortalProps) {
  const canManageEstablishments = role === 'ADMIN' || role === 'ADMIN_EMPRESA'
  const canRequestInspection = role === 'ADMIN' || role === 'ADMIN_EMPRESA' || role === 'USUARIO_DELEGADO'
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
  const [openRepKey, setOpenRepKey] = useState<string | null>(null)
  const [repDetails, setRepDetails] = useState<Record<string, any>>({})
  const [availableRepresentatives, setAvailableRepresentatives] = useState<any[]>([])
  const [representativeMode, setRepresentativeMode] = useState<'select' | 'new'>('select')

  const [instFormError, setInstFormError] = useState('')
  const [repFormError, setRepFormError] = useState('')
  const [showEditInstitutionModal, setShowEditInstitutionModal] = useState(false)
  const [editingInstitution, setEditingInstitution] = useState<any>(null)
  const [editFormError, setEditFormError] = useState('')
  const [editingDraft, setEditingDraft] = useState(false)

  // Geographic selectors for institution creation
  const [provinces, setProvinces] = useState<any[]>([])
  const [municipalities, setMunicipalities] = useState<any[]>([])
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>('')
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string>('')

  // Upload progress / busy
  const [submitting, setSubmitting] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  // Fetch initial data
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
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

      const seenEvaluations = new Map<number, any>()
      for (const evaluation of loadedEvaluations) {
        if (evaluation?.evaluationId) seenEvaluations.set(evaluation.evaluationId, evaluation)
      }
      for (const request of loadedRequests) {
        for (const evaluation of request?.case?.evaluations ?? []) {
          if (!evaluation?.evaluationId || seenEvaluations.has(evaluation.evaluationId)) continue
          seenEvaluations.set(evaluation.evaluationId, {
            ...evaluation,
            institution: evaluation.institution ?? request.institution,
            case: evaluation.case ?? request.case,
          })
        }
      }

      setRequests(loadedRequests)
      setInstitutions(loadedInstitutions)
      setEvaluations([...seenEvaluations.values()])

      if (loadedRequests.length > 0) {
        setSelectedRequestId((current) => current ?? loadedRequests[0].bpmRequestId)
      }
    } catch (err) {
      console.error('Error loading CompanyPortal data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadData(true)
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
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
    setSelectedMunicipalityId('')
    setMunicipalities([])
    if (!provinceId) return
    try {
      const res = await institutionsService.listMunicipalities(Number(provinceId))
      if (res.valid) setMunicipalities(res.data)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    setEditingDraft(false)
  }, [selectedRequestId])

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
    const statuses = requests.map((request) => requestLifecycle(request))
    const totalRequests = requests.length
    const inProgress = statuses.filter((status) => isOpenLifecycle(status)).length
    const drafts = statuses.filter((status) => status === 'BORRADOR').length
    const completed = statuses.filter((status) => isDoneLifecycle(status)).length
    return { totalRequests, inProgress, drafts, completed }
  }, [requests])

  const handleUpdateRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedReqDetail || selectedReqDetail.status !== 'BORRADOR') return
    const form = new FormData(e.currentTarget)
    const tipoEstablecimiento = String(form.get('tipoEstablecimiento') || '')
    const motivo = String(form.get('motivo') || '')
    const observaciones = String(form.get('observaciones') || '')
    if (!tipoEstablecimiento || !motivo) {
      notify('Please complete all required fields.')
      return
    }
    setSubmitting(true)
    try {
      const res = await bpmRequestsService.update(selectedReqDetail.bpmRequestId, {
        tipoEstablecimiento,
        motivo,
        observaciones,
      })
      if (res.valid) {
        notify(`BPM Request #${selectedReqDetail.bpmRequestId} updated.`)
        setEditingDraft(false)
        setSelectedReqDetail((current: any) => current ? { ...current, ...res.data } : res.data)
        await loadData()
      }
    } catch (err: any) {
      notify(apiErrorMessage(err, 'Could not update the draft request.'))
    } finally {
      setSubmitting(false)
    }
  }

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
      notify(apiErrorMessage(err, 'Could not submit the request.'))
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
      notify(apiErrorMessage(err, 'Error attaching document.'))
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
      notify(apiErrorMessage(err, 'Error creating BPM request.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Register Institution
  const handleCreateInstitution = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setInstFormError('')
    const form = new FormData(e.currentTarget)
    const municipalityId = Number(selectedMunicipalityId)
    if (!Number.isInteger(municipalityId) || municipalityId <= 0) {
      setInstFormError('Select a province and a municipality before registering.')
      return
    }

    const body = {
      name: String(form.get('name') || '').trim(),
      nombreComercial: String(form.get('nombreComercial') || '').trim(),
      rnc: formatRnc(String(form.get('rnc') || '')),
      actividadEconomica: String(form.get('actividadEconomica') || '').trim(),
      streetName: String(form.get('streetName') || '').trim(),
      streetNum: formatStreetNumber(String(form.get('streetNum') || '')),
      phoneNumber: String(form.get('phoneNumber') || '').trim(),
      email: String(form.get('email') || '').trim(),
      municipalityId,
    }
    const establishmentError = validateEstablishment(body, true)
    if (establishmentError) {
      setInstFormError(establishmentError)
      return
    }

    setSubmitting(true)
    try {
      const res = await institutionsService.create(body)
      if (res.valid) {
        notify(`Establishment "${res.data.name}" registered successfully.`)
        setShowNewInstitutionModal(false)
        setSelectedProvinceId('')
        setSelectedMunicipalityId('')
        setMunicipalities([])
        await loadData()
      } else {
        const msg = res?.error?.message || 'Error registering establishment.'
        setInstFormError(msg)
        notify(msg)
      }
    } catch (err: any) {
      const msg = apiErrorMessage(err, 'Error registering establishment.')
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
      name: String(form.get('name') || '').trim(),
      nombreComercial: String(form.get('nombreComercial') || '').trim() || undefined,
      rnc: formatRnc(String(form.get('rnc') || '')),
      actividadEconomica: String(form.get('actividadEconomica') || '').trim() || undefined,
      streetName: String(form.get('streetName') || '').trim(),
      streetNum: formatStreetNumber(String(form.get('streetNum') || '')) || undefined,
      phoneNumber: String(form.get('phoneNumber') || '').trim(),
      email: String(form.get('email') || '').trim(),
    }
    const establishmentError = validateEstablishment(body, false)
    if (establishmentError) {
      setEditFormError(establishmentError)
      return
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
      const msg = apiErrorMessage(err, 'Could not update establishment. Please try again.')
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
    const person = {
      name: String(form.get('name') || '').trim(),
      email: String(form.get('email') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      cedula: formatNationalId(String(form.get('cedula') || '')),
    }
    if (!isValidPersonName(person.name)) {
      setRepFormError('Enter the representative full name.')
      return
    }
    if (!isValidNationalId(person.cedula)) {
      setRepFormError('National ID must use the format 000-0000000-0.')
      return
    }
    if (!isValidEmail(person.email)) {
      setRepFormError('Enter a valid email address.')
      return
    }
    if (!isValidPhone(person.phone)) {
      setRepFormError('Enter a valid phone number, such as (809) 555-0101 or +44 20 7946 0958.')
      return
    }
    const body = { person, type }

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
      const msg = apiErrorMessage(err, 'Error adding representative.')
      setRepFormError(msg)
      notify(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleLinkRepresentative = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setRepFormError('')
    if (!selectedInstForRep) return
    const form = new FormData(e.currentTarget)
    const type = String(form.get('tipo') || 'CALIDAD') as 'LEGAL' | 'CALIDAD' | 'CONTACTO'
    const personId = Number(form.get('personId'))
    setSubmitting(true)
    try {
      const res = await institutionsService.linkRepresentative(selectedInstForRep, { personId, type })
      if (res.valid) {
        notify('Representative assigned successfully.')
        setShowAddRepresentModal(false)
        await loadData()
      }
    } catch (err: any) {
      const msg = apiErrorMessage(err, 'Error assigning representative.')
      setRepFormError(msg)
      notify(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const openAddRepresentative = async (institutionId: number) => {
    setSelectedInstForRep(institutionId)
    setRepresentativeMode('select')
    setRepFormError('')
    setShowAddRepresentModal(true)
    try {
      const res = await institutionsService.listAvailableRepresentatives(institutionId)
      if (res.valid) setAvailableRepresentatives(res.data)
    } catch (err: any) {
      setAvailableRepresentatives([])
      setRepFormError(apiErrorMessage(err, 'Could not load available representatives.'))
    }
  }

  const selectedLifecycle = requestLifecycle(selectedReqDetail)
  const currentStage = lifecycleStage(selectedLifecycle)
  const timelineProgress = currentStage > 0 ? Math.min((currentStage - 1) / 4, 1) : 0
  const stepState = (step: number) => {
    if (currentStage < 1 || currentStage < step) return ''
    return currentStage === step ? 'done active' : 'done'
  }

  const toggleRepresentative = async (institutionId: number, rep: any) => {
    const key = `${institutionId}-${rep.representId}`
    if (openRepKey === key) {
      setOpenRepKey(null)
      return
    }
    setOpenRepKey(key)
    if (rep.person?.cedula || rep.person?.email || rep.person?.phone) {
      setRepDetails((current) => ({ ...current, [key]: rep }))
      return
    }
    try {
      const res = await institutionsService.getById(institutionId)
      const list = res?.data?.representantes ?? res?.data?.represents ?? []
      const full = list.find((item: any) => item.representId === rep.representId) || rep
      setRepDetails((current) => ({ ...current, [key]: full }))
    } catch {
      setRepDetails((current) => ({ ...current, [key]: rep }))
    }
  }

  const getBadgeClass = (st?: string) => {
    switch (st) {
      case 'BORRADOR': return 'cp-badge-draft'
      case 'PENDIENTE_ASIGNACION': return 'cp-badge-pending'
      case 'ASIGNADO':
      case 'ASIGNADA': return 'cp-badge-assigned'
      case 'EN_PROCESO':
      case 'FINALIZADA':
      case 'ENVIADO':
      case 'EN_REVISION':
      case 'EN_CORRECCION': return 'cp-badge-in-progress'
      case 'COMPLETADA':
      case 'APROBADA':
      case 'APROBADO':
      case 'CERRADO': return 'cp-badge-done'
      case 'RECHAZADA':
      case 'RECHAZADO': return 'cp-badge-rejected'
      default: return 'cp-badge-pending'
    }
  }

  const fieldStepLabel = selectedLifecycle === 'EN_REVISION' || selectedLifecycle === 'ENVIADO'
    ? 'Under Review'
    : selectedLifecycle === 'EN_CORRECCION'
      ? 'Correction'
      : selectedLifecycle === 'FINALIZADA'
        ? 'Finished'
        : 'In Field'

  const formatStatus = (st?: string) => statusLabel(st)

  return (
    <section className="company-portal">
      {/* 1. Header Hero Banner */}
      <div className="cp-hero">
        <div className="cp-hero-info">
          <small>Regulated Establishment Portal · BPM</small>
          {mainInstitution ? (
            <>
              <h1>{mainInstitution.name}</h1>
              <p>
                <span>🏢 RNC: <strong>{mainInstitution.rnc || 'Not available'}</strong></span>
                {mainInstitution.streetName && (
                  <span>📍 {mainInstitution.streetName} #{mainInstitution.streetNum || ''}</span>
                )}
                {mainInstitution.phoneNumber && <span>📞 {mainInstitution.phoneNumber}</span>}
                {mainInstitution.email && <span>✉ {mainInstitution.email}</span>}
              </p>
            </>
          ) : (
            <>
              <h1>Company Self-Service Portal</h1>
              <p style={{ marginTop: '0.35rem', opacity: 0.95, maxWidth: '680px', lineHeight: '1.45' }}>
                <span>🏢 You do not have a linked establishment yet. Register your company or facility with its official RNC to start BPM sanitary certification requests.</span>
              </p>
            </>
          )}
        </div>
        <div className="cp-hero-actions">
          {canRequestInspection && (
            <button
              type="button"
              className="cp-btn-white"
              onClick={() => {
                if (!mainInstitution && canManageEstablishments) {
                  notify('Register your establishment before creating a BPM request.')
                  setShowNewInstitutionModal(true)
                  return
                }
                if (!mainInstitution) {
                  notify('No establishment is linked to this account yet.')
                  return
                }
                setShowNewRequestModal(true)
              }}
            >
              ➕ New BPM Request
            </button>
          )}
          {canManageEstablishments && (
            <button
              type="button"
              className="cp-btn-white"
              style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
              onClick={() => setShowNewInstitutionModal(true)}
            >
              🏭 Register Establishment
            </button>
          )}
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
                  onClick={() => {
                    if (institutions.length === 0) {
                      notify?.('You must register your establishment before creating a BPM request.')
                      setShowNewInstitutionModal(true)
                    } else {
                      setShowNewRequestModal(true)
                    }
                  }}
                >
                  {institutions.length === 0 ? '🏭 Register first establishment' : '➕ Create first BPM request'}
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
                      <span className={`cp-badge ${getBadgeClass(requestLifecycle(req))}`}>
                        {formatStatus(requestLifecycle(req))}
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
                  <span className={`cp-badge ${getBadgeClass(selectedLifecycle)}`}>
                    {formatStatus(selectedLifecycle)}
                  </span>
                </div>

                {/* Timeline Stepper */}
                <div className="cp-timeline" style={{ '--cp-progress': timelineProgress }}>
                  <div className={`cp-step ${stepState(1)}`}>
                    <div className="cp-step-circle">1</div>
                    <span className="cp-step-label">Draft</span>
                  </div>
                  <div className={`cp-step ${stepState(2)}`}>
                    <div className="cp-step-circle">2</div>
                    <span className="cp-step-label">Submitted</span>
                  </div>
                  <div className={`cp-step ${stepState(3)}`}>
                    <div className="cp-step-circle">3</div>
                    <span className="cp-step-label">Assigned</span>
                  </div>
                  <div className={`cp-step ${stepState(4)}`}>
                    <div className="cp-step-circle">4</div>
                    <span className="cp-step-label">{currentStage >= 5 ? 'In Field' : fieldStepLabel}</span>
                  </div>
                  <div className={`cp-step ${stepState(5)}`}>
                    <div className="cp-step-circle">5</div>
                    <span className="cp-step-label">Decision</span>
                  </div>
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: '#334155' }}>
                  Current state: <strong>{formatStatus(selectedLifecycle)}</strong>
                  {selectedReqDetail.case?.caseId ? ` · Case #${selectedReqDetail.case.caseId}` : ''}
                </p>

                {/* Information block — drafts stay editable until the request is submitted */}
                {selectedReqDetail.status === 'BORRADOR' && canRequestInspection && editingDraft ? (
                  <form onSubmit={handleUpdateRequest} className="cp-form" style={{ margin: '1rem 0' }}>
                    <label>
                      Establishment type *
                      <input
                        name="tipoEstablecimiento"
                        required
                        defaultValue={selectedReqDetail.tipoEstablecimiento || ''}
                      />
                    </label>
                    <label>
                      Request reason *
                      <textarea name="motivo" required defaultValue={selectedReqDetail.motivo || ''} />
                    </label>
                    <label>
                      Technical observations (optional)
                      <textarea name="observaciones" defaultValue={selectedReqDetail.observaciones || ''} />
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" disabled={submitting} className="cp-btn-primary">
                        {submitting ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        className="cp-btn-secondary"
                        disabled={submitting}
                        onClick={() => setEditingDraft(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
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
                      <strong style={{ color: '#00236f' }}>Assigned evaluator: </strong>
                      <span>
                        {pickCurrentEvaluation(selectedReqDetail.case?.evaluations)?.technician?.person?.name
                          || selectedReqDetail.case?.technician?.person?.name
                          || (selectedLifecycle === 'BORRADOR' || selectedLifecycle === 'PENDIENTE_ASIGNACION'
                            ? 'Pending assignment'
                            : 'Not assigned')}
                      </span>
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
                )}

                {/* Document Attachments */}
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#00236f' }}>
                    📎 Required Health Documentation
                  </h3>
                  {selectedReqDetail.attachments && selectedReqDetail.attachments.length > 0 ? (
                    <div className="cp-attachments-list">
                      {selectedReqDetail.attachments.map((att: any) => (
                        <div key={att.attachmentId} className="cp-attachment-item">
                          <span>📄 {att.fileName || att.originalName || att.filename || `Attachment #${att.attachmentId}`}</span>
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

                <StatusHistory request={selectedReqDetail} />

                {/* Primary Action Buttons */}
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {selectedReqDetail.status === 'BORRADOR' && canRequestInspection && !editingDraft && (
                    <>
                      <button
                        type="button"
                        disabled={submitting}
                        className="cp-btn-secondary"
                        onClick={() => setEditingDraft(true)}
                      >
                        ✏️ Edit draft
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        className="cp-btn-primary"
                        onClick={() => void handleSubmitRequest(selectedReqDetail.bpmRequestId)}
                      >
                        🚀 Submit for Health Evaluation
                      </button>
                    </>
                  )}

                  {isDoneLifecycle(selectedLifecycle) && (
                    <button
                      type="button"
                      className="cp-btn-primary"
                      style={{ background: '#047857' }}
                      onClick={() => {
                        const evalId = pickCurrentEvaluation(selectedReqDetail.case?.evaluations)?.evaluationId
                        if (!evalId) {
                          notify('No official certificate is available for this request yet.')
                          return
                        }
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
            {canManageEstablishments && (
              <button
                type="button"
                className="cp-btn-primary"
                onClick={() => setShowNewInstitutionModal(true)}
              >
                ➕ Register New Establishment
              </button>
            )}
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
              <p>
                {canManageEstablishments
                  ? 'Register your processing plant, distribution center, or food service location.'
                  : 'No establishment is linked to this account.'}
              </p>
              {canManageEstablishments && (
                <button
                  type="button"
                  className="cp-btn-primary"
                  onClick={() => setShowNewInstitutionModal(true)}
                >
                  Register Establishment
                </button>
              )}
            </div>
          ) : (
            <div className="cp-establishment-grid">
              {institutions.map((inst) => (
                <div key={inst.institutionId} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', background: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <div className="cp-establishment-head">
                    <div>
                      <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.05rem', color: '#00236f' }}>{inst.name}</h3>
                      <small style={{ color: '#64748b' }}>{inst.nombreComercial || 'Trade name not assigned'}</small>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="cp-badge cp-badge-assigned">RNC {inst.rnc}</span>
                      {canManageEstablishments && (
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
                      )}
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
                    <div className="cp-establishment-head">
                      <strong style={{ fontSize: '0.82rem', color: '#00236f', textTransform: 'uppercase' }}>
                        👥 Accredited Representatives
                      </strong>
                      {canManageEstablishments && (
                        <button
                          type="button"
                          className="cp-btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                          onClick={() => {
                            void openAddRepresentative(inst.institutionId)
                          }}
                        >
                          ➕ Add
                        </button>
                      )}
                    </div>

                    {(inst.representantes ?? inst.represents ?? []).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {(inst.representantes ?? inst.represents ?? []).map((rep: any) => {
                          const repKey = `${inst.institutionId}-${rep.representId}`
                          const open = openRepKey === repKey
                          const detail = repDetails[repKey] || rep
                          return (
                            <div key={rep.representId} style={{ background: '#f8fafc', padding: '0.45rem 0.65rem', borderRadius: '6px', fontSize: '0.82rem' }}>
                              <div className="cp-establishment-head">
                                <span><strong>{detail.person?.name || rep.person?.name || 'Representative'}</strong></span>
                                <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                                  <span style={{ color: '#00236f', fontWeight: 600 }}>{representativeRole(detail.type || detail.tipo || rep.type || rep.tipo)}</span>
                                  {canManageEstablishments && (
                                    <button
                                      type="button"
                                      className="cp-btn-secondary"
                                      style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
                                      onClick={() => void toggleRepresentative(inst.institutionId, rep)}
                                    >
                                      {open ? 'Hide details' : 'View details'}
                                    </button>
                                  )}
                                </span>
                              </div>
                              {open && canManageEstablishments && (
                                <div style={{ marginTop: '0.45rem', display: 'grid', gap: '0.2rem', color: '#334155' }}>
                                  <div><strong>National ID:</strong> {detail.person?.cedula || '—'}</div>
                                  <div><strong>Phone:</strong> {detail.person?.phone || '—'}</div>
                                  <div><strong>Email:</strong> {detail.person?.email || '—'}</div>
                                  <div><strong>Role:</strong> {representativeRole(detail.type || detail.tipo)}</div>
                                </div>
                              )}
                            </div>
                          )
                        })}
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
                  <th>Evaluator</th>
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
                    <td>{new Date(ev.scheduledDate).toLocaleDateString('en-US')}</td>
                    <td>{ev.technician?.person?.name || 'Not assigned'}</td>
                    <td>
                      <span className={`cp-badge ${ev.score?.nivelRiesgo === 'ALTO' ? 'cp-badge-rejected' : 'cp-badge-done'}`}>
                        {ev.score?.nivelRiesgo ? statusLabel(ev.score.nivelRiesgo) : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <span className={`cp-badge ${getBadgeClass(evaluationLifecycle(ev))}`}>
                        {formatStatus(evaluationLifecycle(ev))}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isDoneLifecycle(evaluationLifecycle(ev)) ? (
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
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Available after approval</span>
                      )}
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
                    <input
                      name="rnc"
                      required
                      placeholder="130123456"
                      inputMode="numeric"
                      autoComplete="off"
                      onKeyDown={(event) => allowFormattedKey(event, { maxDigits: 9 })}
                      onChange={maskedChange(formatRnc)}
                    />
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
                    <select
                      name="municipalityId"
                      required
                      disabled={!selectedProvinceId}
                      value={selectedMunicipalityId}
                      onChange={(e) => setSelectedMunicipalityId(e.target.value)}
                    >
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
                    <input
                      name="streetNum"
                      placeholder="42"
                      inputMode="numeric"
                      autoComplete="off"
                      onKeyDown={(event) => allowFormattedKey(event, { maxDigits: 6 })}
                      onChange={maskedChange(formatStreetNumber)}
                    />
                  </label>
                </div>

                <div className="cp-form-row">
                  <label>
                    Phone *
                    <input
                      name="phoneNumber"
                      required
                      placeholder="(809) 555-1234"
                      inputMode="tel"
                      autoComplete="off"
                      onKeyDown={(event) => allowFormattedKey(event, { allowPlus: true, maxDigits: event.currentTarget.value.includes('+') ? 15 : 10 })}
                      onChange={maskedChange(formatPhoneInput)}
                    />
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
            <form onSubmit={representativeMode === 'select' ? handleLinkRepresentative : handleAddRepresentative}>
              <div className="cp-modal-body cp-form">
                {repFormError && <div style={{padding:'0.6rem 0.85rem',background:'#fff0f0',border:'1px solid #fca5a5',borderRadius:'6px',color:'#b91c1c',fontSize:'0.82rem',marginBottom:'0.75rem'}}>{repFormError}</div>}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.9rem' }}>
                  <button type="button" className="cp-btn-secondary" onClick={() => setRepresentativeMode('select')} disabled={representativeMode === 'select'}>
                    Select existing
                  </button>
                  <button type="button" className="cp-btn-secondary" onClick={() => setRepresentativeMode('new')} disabled={representativeMode === 'new'}>
                    Register new
                  </button>
                </div>
                <label>
                  Representative Type *
                  <select name="tipo" defaultValue="CALIDAD">
                    <option value="CALIDAD">Quality / Food Safety Manager</option>
                    <option value="LEGAL">Legal Representative</option>
                    <option value="CONTACTO_PRINCIPAL">Main Operational Contact</option>
                  </select>
                </label>

                {representativeMode === 'select' ? (
                  <label>
                    Available Representative *
                    <select name="personId" required defaultValue="">
                      <option value="">Select a representative</option>
                      {availableRepresentatives.map((rep: any) => (
                        <option key={rep.personId} value={rep.personId}>
                          {rep.person?.name || `Representative #${rep.personId}`} ({rep.person?.cedula})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : <>
                <div className="cp-form-row">
                  <label>
                    Full Name *
                    <input name="name" required placeholder="e.g. Dr. Carmen Santos" />
                  </label>
                  <label>
                    National ID / Document *
                    <input
                      name="cedula"
                      required
                      placeholder="000-0000000-0"
                      inputMode="numeric"
                      autoComplete="off"
                      onKeyDown={(event) => allowFormattedKey(event, { maxDigits: 11 })}
                      onChange={maskedChange(formatNationalId)}
                    />
                  </label>
                </div>

                <div className="cp-form-row">
                  <label>
                    Email *
                    <input type="email" name="email" required placeholder="csantos@company.com" />
                  </label>
                  <label>
                    Phone *
                    <input
                      name="phone"
                      required
                      placeholder="(809) 555-8899"
                      inputMode="tel"
                      autoComplete="off"
                      onKeyDown={(event) => allowFormattedKey(event, { allowPlus: true, maxDigits: event.currentTarget.value.includes('+') ? 15 : 10 })}
                      onChange={maskedChange(formatPhoneInput)}
                    />
                  </label>
                </div>

                <label>
                  Position in Company
                  <input name="cargo" placeholder="e.g. Quality Assurance Manager" />
                </label>
                </>}
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
                  {submitting ? 'Saving…' : representativeMode === 'select' ? 'Assign Representative' : 'Register Representative'}
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
                  <label>RNC *<input name="rnc" required defaultValue={formatRnc(editingInstitution.rnc || '')} inputMode="numeric" autoComplete="off" onKeyDown={(event) => allowFormattedKey(event, { maxDigits: 9 })} onChange={maskedChange(formatRnc)} /></label>
                  <label>Economic Activity<input name="actividadEconomica" defaultValue={editingInstitution.actividadEconomica || ''} /></label>
                </div>
                <div className="cp-form-row">
                  <label>Street / Avenue *<input name="streetName" required defaultValue={editingInstitution.streetName || ''} /></label>
                  <label>Street Number<input name="streetNum" defaultValue={formatStreetNumber(editingInstitution.streetNum || '')} inputMode="numeric" autoComplete="off" onKeyDown={(event) => allowFormattedKey(event, { maxDigits: 6 })} onChange={maskedChange(formatStreetNumber)} /></label>
                </div>
                <div className="cp-form-row">
                  <label>Phone *<input name="phoneNumber" required defaultValue={formatPhoneInput(editingInstitution.phoneNumber || '')} inputMode="tel" autoComplete="off" onKeyDown={(event) => allowFormattedKey(event, { allowPlus: true, maxDigits: event.currentTarget.value.includes('+') ? 15 : 10 })} onChange={maskedChange(formatPhoneInput)} /></label>
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
