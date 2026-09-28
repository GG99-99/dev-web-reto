// @ts-nocheck
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  assessFormCompleteness,
  type AskValue,
  type FormCaseContext,
  type FormTemplateTree,
  type Evidence,
  type FormAnswers,
} from '@reto/shared'
import {
  catalogsService,
  evidencesService,
  formExecutionService,
  institutionsService,
  evaluationsService,
  reportsService,
  offlineStorage,
} from './services'
import type { Evaluation } from './App'
import { statusLabel } from './statusLabels'
import './App.css'
import './FieldAssessment.css'

type LiveFieldProps = {
  items?: Evaluation[]
  item?: Evaluation
  live: boolean
  inform: (message: string) => void
  onViewReport?: (evaluationId: number, answers?: FormAnswers) => void
  onEvaluationUpdated?: (evaluationId: number, patch: Partial<Evaluation>) => void
}

export interface StructuredQuestion {
  key: string
  txt: string
  h1Id: number
  chapterName: string
  sectionName: string
  codeLabel: string
  askType: 'h1' | 'h2' | 'h3' | 'h4'
  askId: number
}

export interface ChapterGroup {
  h1Id: number
  name: string
  codePrefix: string
  questions: StructuredQuestion[]
}

type AnswerMap = Record<string, AskValue>
type NotesMap = Record<string, string>

const isActionableAssessment = (evaluation?: Evaluation) =>
  evaluation?.status === 'PROGRAMADA' ||
  evaluation?.status === 'REPROGRAMADA' ||
  evaluation?.status === 'EN_PROCESO' ||
  evaluation?.status === 'EN_CORRECCION'

interface LiveRiskScore {
  percent: number
  riskScore: number
  level: 'BAJO' | 'MEDIO' | 'ALTO'
  frequency: 'ANUAL' | 'SEMESTRAL' | 'TRIMESTRAL'
  totalAnswered: number
  totalApplicable: number
}

const COMPLIANCE_WEIGHTS: Record<Exclude<AskValue, 'N/A'>, number> = {
  C: 1,
  CP: 0.5,
  NC: 0,
}

function calculateLiveRisk(answers: AnswerMap): LiveRiskScore {
  const values = Object.values(answers)
  const totalAnswered = values.length
  const applicable = values.filter((v): v is Exclude<AskValue, 'N/A'> => v !== 'N/A')

  if (applicable.length === 0) {
    return {
      percent: 0,
      riskScore: 0,
      level: 'BAJO',
      frequency: 'ANUAL',
      totalAnswered,
      totalApplicable: 0,
    }
  }

  const sum = applicable.reduce((acc, v) => acc + COMPLIANCE_WEIGHTS[v], 0)
  const avg = sum / applicable.length
  const percent = Number((avg * 100).toFixed(1))
  const riskScore = Number(((1 - avg) * 10).toFixed(1))

  let level: 'BAJO' | 'MEDIO' | 'ALTO' = 'BAJO'
  let frequency: 'ANUAL' | 'SEMESTRAL' | 'TRIMESTRAL' = 'ANUAL'

  if (riskScore > 6.3) {
    level = 'ALTO'
    frequency = 'TRIMESTRAL'
  } else if (riskScore > 3.6) {
    level = 'MEDIO'
    frequency = 'SEMESTRAL'
  } else {
    level = 'BAJO'
    frequency = 'ANUAL'
  }

  return {
    percent,
    riskScore,
    level,
    frequency,
    totalAnswered,
    totalApplicable: applicable.length,
  }
}

function apiMessage(err: any, fallback: string) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || fallback
}

function notesFromAnswers(list: any): NotesMap {
  const collected: NotesMap = {}
  if (!Array.isArray(list)) return collected
  for (const answer of list) {
    if (answer?.key && typeof answer.note === 'string' && answer.note.trim()) {
      collected[answer.key] = answer.note.trim()
    }
  }
  return collected
}

export default function LiveField({ items = [], item, live, inform, onViewReport, onEvaluationUpdated }: LiveFieldProps) {
  // Manejo de evaluación activa seleccionada
  const [selectedEvalId, setSelectedEvalId] = useState<number | null>(() => {
    return item?.evaluationId ?? items.find(isActionableAssessment)?.evaluationId ?? items[0]?.evaluationId ?? null
  })

  // Lista combinada de evaluaciones disponibles
  const availableEvals = useMemo(() => {
    if (items && items.length > 0) return items
    if (item) return [item]
    return []
  }, [items, item])

  const activeItem = useMemo(() => {
    return availableEvals.find((e) => e.evaluationId === selectedEvalId) ?? availableEvals.find(isActionableAssessment) ?? availableEvals[0] ?? null
  }, [availableEvals, selectedEvalId])

  // A session can be restored after the assigned workload has changed. Prefer an
  // actionable appointment instead of leaving the assessor on a cancelled record.
  useEffect(() => {
    const selected = availableEvals.find((e) => e.evaluationId === selectedEvalId)
    if (selected && isActionableAssessment(selected)) return
    const actionable = availableEvals.find(isActionableAssessment)
    if (actionable) setSelectedEvalId(actionable.evaluationId)
  }, [availableEvals, selectedEvalId])

  // Estados de datos
  const [template, setTemplate] = useState<FormTemplateTree | null>(null)
  const [caseContext, setCaseContext] = useState<FormCaseContext>({})
  const [activeChapterId, setActiveChapterId] = useState<number | null>(null)
  const templateForEval = useRef<number | null>(null)
  const loadedTemplateId = useRef<number | null>(null)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [notes, setNotes] = useState<NotesMap>({})
  const [evidences, setEvidences] = useState<Evidence[]>([])

  // Metadatos de la evaluación
  const [representatives, setRepresentatives] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [foods, setFoods] = useState<any[]>([])
  const [representId, setRepresentId] = useState('')
  const [foodId, setFoodId] = useState('')

  // Estados de estado de ejecución
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [recordStatus, setRecordStatus] = useState('')
  const [correction, setCorrection] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [lastSavedTime, setLastSavedTime] = useState<string>('')
  const [finishSummary, setFinishSummary] = useState<any | null>(null)

  // Telemetría de dispositivo y red PWA
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const uploadInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const startedLocally = useRef<Set<number>>(new Set())
  const hydratedFor = useRef<number | null>(null)

  // Monitoreo de conectividad en tiempo real
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      inform('Connection restored. Background synchronization will resume.')
      void checkAndFlushSyncQueue()
    }
    const handleOffline = () => {
      setIsOnline(false)
      inform('No internet connection. PWA offline mode enabled with IndexedDB.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [inform])

  // Geolocalización GPS en vivo
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
        () => setGps(null),
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }
  }, [])

  // Load the template bound to this evaluation, or the one configured for its case type.
  useEffect(() => {
    if (!activeItem) return
    let cancelled = false
    const evalId = activeItem.evaluationId
    if (templateForEval.current !== evalId) {
      templateForEval.current = evalId
      loadedTemplateId.current = null
      setTemplate(null)
      setCaseContext({})
      setActiveChapterId(null)
    }

    async function loadTemplate() {
      if (!isOnline) {
        const cachedId = loadedTemplateId.current
        if (!cachedId) return
        const cached = await offlineStorage.getCachedTemplateTree(cachedId)
        if (!cancelled && cached) setTemplate(cached)
        return
      }

      try {
        const res = await formExecutionService.getEvaluationTemplate(evalId)
        if (cancelled || !res.valid) return
        loadedTemplateId.current = res.data.formTemplateId
        setTemplate(res.data.template)
        setCaseContext(res.data.context ?? {})
        await offlineStorage.saveCachedTemplateTree(res.data.template)
        const firstRequired = (res.data.completeness?.chapters ?? []).find((chapter) => chapter.status !== 'not_applicable')
        const firstId = firstRequired?.h1Id ?? res.data.template?.h1s?.[0]?.h1Id
        if (firstId) setActiveChapterId((prev) => prev ?? firstId)
      } catch {
        // Finish stays blocked until the official template loads.
      }
    }

    void loadTemplate()
    return () => { cancelled = true }
  }, [activeItem, isOnline])

  // Cargar datos de la evaluación activa (hidratación híbrida backend + local).
  // Going offline must not replace a started inspection with the stale list status.
  useEffect(() => {
    if (!activeItem) return
    let cancelled = false
    const evalId = activeItem.evaluationId
    const switching = hydratedFor.current !== evalId
    hydratedFor.current = evalId

    if (switching) {
      setAnswers({})
      setNotes({})
      setEvidences([])
      setRecordStatus(activeItem.status)
      setCorrection(null)
      setFinished(activeItem.status === 'FINALIZADA')
      setStarted(
        activeItem.status === 'EN_PROCESO' ||
        activeItem.status === 'EN_CORRECCION' ||
        activeItem.status === 'FINALIZADA' ||
        startedLocally.current.has(evalId),
      )
    }

    async function hydrateEvaluation() {
      let serverDetail: any = null
      if (isOnline) {
        try {
          const detailRes = await evaluationsService.getById(evalId)
          if (!cancelled && detailRes.valid) serverDetail = detailRes.data
        } catch {
          serverDetail = null
        }
      }

      const resetToStart =
        serverDetail &&
        (serverDetail.status === 'PROGRAMADA' || serverDetail.status === 'REPROGRAMADA') &&
        !serverDetail.formResponse
      if (resetToStart) {
        await offlineStorage.deleteLocalDraft(evalId)
        await offlineStorage.removeSyncQueueItem(evalId)
        if (cancelled) return
        startedLocally.current.delete(evalId)
        setAnswers({})
        setNotes({})
        setEvidences([])
        setStarted(false)
        setFinished(false)
        setLastSavedTime('')
      } else {
        const localDraft = await offlineStorage.getLocalDraft(evalId)
        if (cancelled) return

        const statusNow = serverDetail?.status ?? activeItem.status
        setRecordStatus(statusNow)
        if (serverDetail?.status && serverDetail.status !== activeItem.status) {
          onEvaluationUpdated?.(evalId, { status: serverDetail.status })
        }
        const correcting = statusNow === 'EN_CORRECCION'
        const startedNow =
          correcting ||
          statusNow === 'EN_PROCESO' ||
          statusNow === 'FINALIZADA' ||
          Boolean(localDraft?.started) ||
          startedLocally.current.has(evalId)
        const finishedNow = !correcting && (
          statusNow === 'FINALIZADA' ||
          (!serverDetail && Boolean(localDraft?.finished) && activeItem.status === 'FINALIZADA')
        )
        setStarted(startedNow)
        setFinished(finishedNow)
        if (startedNow) startedLocally.current.add(evalId)
        if (correcting) {
          await offlineStorage.saveLocalDraft(
            evalId,
            Array.isArray(serverDetail?.formResponse?.answers) ? serverDetail.formResponse.answers : (localDraft?.answers ?? []),
            localDraft?.notes ?? {},
            { started: true, finished: false },
          )
        }

        if (localDraft) {
          const answerObj: AnswerMap = {}
          localDraft.answers.forEach((a) => {
            answerObj[a.key] = a.value
          })
          setAnswers((current) => ({ ...answerObj, ...current }))
          setNotes((current) => ({ ...notesFromAnswers(localDraft.answers), ...(localDraft.notes || {}), ...current }))
          if (localDraft.updatedAt) {
            setLastSavedTime(new Date(localDraft.updatedAt).toLocaleTimeString())
          }
        }

        if (serverDetail?.formResponse?.answers && Array.isArray(serverDetail.formResponse.answers)) {
          if (correcting) {
            const official: AnswerMap = {}
            serverDetail.formResponse.answers.forEach((ans: any) => {
              if (ans?.key && ans.value) official[ans.key] = ans.value
            })
            setAnswers(official)
            setNotes({
              ...notesFromAnswers(serverDetail.formResponse.answers),
              ...(localDraft?.notes || {}),
            })
          } else {
            setAnswers((current) => {
              const merged = { ...current }
              serverDetail.formResponse.answers.forEach((ans: any) => {
                if (ans && ans.key && ans.value && merged[ans.key] === undefined) {
                  merged[ans.key] = ans.value
                }
              })
              return merged
            })
            setNotes((current) => ({ ...notesFromAnswers(serverDetail.formResponse.answers), ...current }))
          }
        }
        if (Array.isArray(serverDetail?.evidences)) {
          setEvidences(serverDetail.evidences)
        }
      }

      if (isOnline) {
        try {
          const evRes = await evidencesService.listByEvaluation(evalId)
          if (!cancelled && evRes.valid && !resetToStart) {
            setEvidences(evRes.data)
          }
        } catch {
          // Trabajar con los datos locales
        }
      }

      // 3. Catálogos para el arranque de la inspección
      const instId = (activeItem as any).institutionId ?? (activeItem as any).institution?.institutionId
      if (instId && isOnline) {
        void institutionsService.getById(instId).then((r) => {
          if (!cancelled && r.valid) setRepresentatives(r.data.representantes ?? [])
        }).catch(() => {})
      }

      if (isOnline) {
        void catalogsService.listCategories().then((r) => {
          if (!cancelled && r.valid) setCategories(r.data)
        }).catch(() => {})
      }
    }

    void hydrateEvaluation()
    void refreshPendingSyncCount()

    return () => { cancelled = true }
  }, [activeItem, isOnline])

  const refreshPendingSyncCount = async () => {
    const queue = await offlineStorage.getPendingSyncQueue()
    setPendingSyncCount(queue.length)
  }

  const answerList = useMemo(
    () => Object.entries(answers).map(([key, value]) => ({ key, value })),
    [answers],
  )
  const completeness = useMemo(
    () => assessFormCompleteness(template, answerList, caseContext),
    [template, answerList, caseContext],
  )
  const chapters = completeness.chapters

  // Capítulo actualmente seleccionado
  const activeChapter = useMemo(() => {
    if (!chapters.length) return null
    return chapters.find((c) => c.h1Id === activeChapterId) ?? chapters.find((c) => c.status !== 'not_applicable') ?? chapters[0]
  }, [chapters, activeChapterId])

  // Preguntas que esta plantilla exige para el tipo de caso actual
  const allQuestions = useMemo(() => {
    return chapters.filter((c) => c.status !== 'not_applicable').flatMap((c) => c.questions)
  }, [chapters])

  const packAnswers = useCallback((answerMap: AnswerMap = answers, noteMap: NotesMap = notes): FormAnswers => {
    return allQuestions
      .filter((question) => answerMap[question.key] !== undefined)
      .map((question) => {
        const note = (noteMap[question.key] || '').trim()
        const row = { key: question.key, txt: question.txt, value: answerMap[question.key] }
        return note ? { ...row, note } : row
      })
  }, [allQuestions, answers, notes])

  // Motor de Riesgo Dinámico en vivo, solo con criterios que aplican a este caso
  const liveRisk = useMemo(() => {
    const applicable = new Set(completeness.applicableKeys)
    const scoped: AnswerMap = {}
    for (const [key, value] of Object.entries(answers)) {
      if (applicable.has(key)) scoped[key] = value
    }
    return calculateLiveRisk(scoped)
  }, [answers, completeness.applicableKeys])

  // Manejador para responder un criterio
  const handleAnswerChange = useCallback(
    (question: StructuredQuestion, value: AskValue) => {
      if (!started || finished || busy || !questionIsEditable(question)) return

      const updatedAnswers: AnswerMap = { ...answers, [question.key]: value }
      setAnswers(updatedAnswers)

      // Guardar inmediatamente en almacenamiento local (IndexedDB + localStorage)
      if (activeItem) {
        const answersList = packAnswers(updatedAnswers, notes)
        void offlineStorage.saveLocalDraft(activeItem.evaluationId, answersList, notes, { started: true })
        setLastSavedTime(new Date().toLocaleTimeString())
      }
    },
    [started, finished, busy, answers, activeItem, notes, correction, recordStatus, packAnswers]
  )

  // Manejador para cambiar nota técnica de un criterio
  const handleNoteChange = useCallback(
    (questionKey: string, text: string) => {
      const updatedNotes = { ...notes, [questionKey]: text }
      setNotes(updatedNotes)

      if (activeItem) {
        const answersList = packAnswers(answers, updatedNotes)
        void offlineStorage.saveLocalDraft(activeItem.evaluationId, answersList, updatedNotes, { started: true })
      }
    },
    [notes, activeItem, answers, packAnswers]
  )

  // Guardar borrador en el backend (o encolar si offline)
  const saveDraft = async () => {
    if (!activeItem) return
    setBusy(true)

    const answersList = packAnswers()

    try {
      // Guardar siempre en local primero
      await offlineStorage.saveLocalDraft(activeItem.evaluationId, answersList, notes, {
        started: true,
        finished,
      })
      setLastSavedTime(new Date().toLocaleTimeString())

      if (isOnline) {
        const result = await formExecutionService.saveAnswers(activeItem.evaluationId, {
          answers: answersList,
        })
        if (!result.valid) {
          inform(result.error.message)
        } else {
          inform('Draft successfully synchronized with the server.')
          await offlineStorage.removeSyncQueueItem(activeItem.evaluationId)
          await refreshPendingSyncCount()
        }
      } else {
        await offlineStorage.enqueueSync(activeItem.evaluationId, answersList)
        await refreshPendingSyncCount()
        inform('Saved in local IndexedDB. Will sync when connection is detected.')
      }
    } catch {
      await offlineStorage.enqueueSync(activeItem.evaluationId, answersList)
      await refreshPendingSyncCount()
      inform('Could not contact the server. Changes saved locally.')
    } finally {
      setBusy(false)
    }
  }

  // Sincronizar cola offline
  const checkAndFlushSyncQueue = async () => {
    const queue = await offlineStorage.getPendingSyncQueue()
    if (!queue.length) return

    setBusy(true)
    let synced = 0

    for (const item of queue) {
      try {
        const res = await formExecutionService.saveAnswers(item.evaluationId, {
          answers: item.answers,
        })
        if (res.valid) {
          await offlineStorage.removeSyncQueueItem(item.evaluationId)
          synced++
        }
      } catch {
        // Intentar luego
      }
    }

    await refreshPendingSyncCount()
    setBusy(false)
    if (synced > 0) {
      inform(`PWA sync completed: ${synced} assessment(s) updated.`)
    }
  }

  useEffect(() => {
    if (!activeItem || recordStatus !== 'EN_CORRECCION' || !isOnline) {
      if (recordStatus !== 'EN_CORRECCION') setCorrection(null)
      return
    }
    let cancelled = false
    const evalId = activeItem.evaluationId
    reportsService.getByEvaluation(evalId).then((res) => {
      if (cancelled || !res.valid) return
      const report = res.data
      const reviews = [...(report.reviews ?? [])].sort(
        (a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime(),
      )
      const latest = reviews.find((item) => item.action === 'DEVOLVER' || item.action === 'SOLICITAR_CORRECCION')
      const flagged = Array.isArray(report.flaggedSections) ? report.flaggedSections.map(String) : []
      setCorrection({
        reportId: report.reportId,
        status: report.status,
        scope: report.correctionScope,
        flagged,
        comments: latest?.comments || '',
        ready: Boolean(
          report.correctionSavedAt &&
          report.correctionRequestedAt &&
          new Date(report.correctionSavedAt).getTime() >= new Date(report.correctionRequestedAt).getTime(),
        ),
      })
      const firstChapter = flagged.find((id) => id.startsWith('chapter:'))
      if (firstChapter) setActiveChapterId(Number(firstChapter.slice('chapter:'.length)))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [activeItem, recordStatus, isOnline])

  const questionIsEditable = (question: StructuredQuestion) => {
    if (recordStatus !== 'EN_CORRECCION') return true
    if (!correction) return false
    if (correction.scope === 'COMPLETA' || correction.status === 'DEVUELTO') return true
    return correction.flagged.includes(`chapter:${question.h1Id}`)
  }

  async function resubmitCorrection() {
    if (!activeItem || !correction?.reportId) return
    setBusy(true)
    try {
      const answersList = packAnswers()
      if (isOnline) {
        await formExecutionService.saveAnswers(activeItem.evaluationId, { answers: answersList })
      }
      const res = await reportsService.resend(correction.reportId)
      if (!res.valid) {
        inform(res.error.message)
        return
      }
      setFinished(true)
      setRecordStatus('FINALIZADA')
      setCorrection(null)
      onEvaluationUpdated?.(activeItem.evaluationId, { status: 'FINALIZADA' })
      inform('Corrected evaluation resubmitted for review.')
    } catch (err: any) {
      inform(apiMessage(err, 'Save the requested correction before resubmitting this evaluation.'))
    } finally {
      setBusy(false)
    }
  }

  // Cargar alimentos de la categoría
  async function chooseCategory(catId: string) {
    setFoodId('')
    if (!catId) {
      setFoods([])
      return
    }
    try {
      const res = await catalogsService.listFoods(Number(catId))
      if (res.valid) setFoods(res.data)
    } catch {
      inform('Could not load food items for this category.')
    }
  }

  // Iniciar la evaluación oficial (RF-12)
  async function startAssessment() {
    if (!activeItem) return
    if (!representId || !foodId) {
      inform('Select the present representative and the food item to assess before starting.')
      return
    }

    setBusy(true)
    try {
      const res = await formExecutionService.start(activeItem.evaluationId, {
        representId: Number(representId),
        foodId: Number(foodId),
      })
      if (!res.valid) {
        inform(res.error.message)
        return
      }
      startedLocally.current.add(activeItem.evaluationId)
      setStarted(true)
      const answersList = packAnswers()
      await offlineStorage.saveLocalDraft(activeItem.evaluationId, answersList, notes, { started: true })
      onEvaluationUpdated?.(activeItem.evaluationId, { status: 'EN_PROCESO' })
      inform('Assessment officially started. You can begin rating the criteria.')
    } catch (err: any) {
      inform(err?.response?.data?.message || 'Error starting the assessment.')
    } finally {
      setBusy(false)
    }
  }

  // Subir evidencia asociada a un criterio específico (RF-15)
  async function handleUploadEvidenceForQuestion(question: StructuredQuestion, file: File) {
    if (!activeItem || !file) return
    setBusy(true)

    try {
      const questionComment = notes[question.key] || `Photographic evidence for ${question.codeLabel}`
      const type = file.type.startsWith('video/')
        ? 'VIDEO'
        : file.type.startsWith('image/')
        ? 'FOTO'
        : 'DOCUMENTO'

      const askParams: any = {}
      if (question.askType === 'h1') askParams.h1AskId = question.askId
      else if (question.askType === 'h2') askParams.h2AskId = question.askId
      else if (question.askType === 'h3') askParams.h3AskId = question.askId
      else if (question.askType === 'h4') askParams.h4AskId = question.askId

      const res = await evidencesService.upload(activeItem.evaluationId, {
        file,
        type,
        comment: questionComment,
        latitude: gps?.lat,
        longitude: gps?.lng,
        ...askParams,
      })

      if (!res.valid) {
        inform(res.error.message)
        return
      }

      setEvidences((current) => [...current, res.data])
      inform(`Evidence successfully uploaded with GPS coordinates (${gps?.lat.toFixed(4)}, ${gps?.lng.toFixed(4)}).`)
    } catch {
      inform('Could not upload evidence at this time.')
    } finally {
      setBusy(false)
    }
  }

  // Eliminar evidencia
  async function deleteEvidence(evidenceId: number) {
    if (finished || busy) return
    setBusy(true)
    try {
      const res = await evidencesService.remove(evidenceId)
      if (res.valid) {
        setEvidences((current) => current.filter((e) => e.evidenceId !== evidenceId))
        inform('Evidence removed.')
      } else {
        inform(res.error.message)
      }
    } catch {
      inform('Could not remove evidence.')
    } finally {
      setBusy(false)
    }
  }

  // Finalizar evaluación y disparar motor de riesgo e informe (RF-14, RF-16)
  async function finishAssessment() {
    if (!activeItem) return
    if (!completeness.canSubmit) {
      inform(completeness.blockReason || 'Required chapters are still incomplete.')
      return
    }

    if (!confirm('Are you sure you want to finish this assessment? Answers will be locked and the technical report will be issued.')) {
      return
    }

    setBusy(true)
    try {
      // Guardar últimas respuestas primero
      const answersList = packAnswers()

      await formExecutionService.saveAnswers(activeItem.evaluationId, { answers: answersList })

      const res = await formExecutionService.finish(activeItem.evaluationId)
      if (!res.valid) {
        inform(res.error.message)
        return
      }

      setFinished(true)
      setFinishSummary(res.data)
      inform(`Assessment finished. Risk level: ${statusLabel(res.data.score.nivelRiesgo)}.`)
    } catch (err: any) {
      inform(apiMessage(err, 'Could not finish the assessment.'))
    } finally {
      setBusy(false)
    }
  }

  if (!live) {
    return (
      <section className="field-container">
        <div className="empty">
          Preview mode cannot change inspection data. Sign in as a Field Assessor to continue.
        </div>
      </section>
    )
  }

  if (!activeItem) {
    return (
      <section className="field-container">
        <div className="empty">
          You do not have an assessment assigned at this time.
        </div>
      </section>
    )
  }

  return (
    <section className="field-container">
      {/* Selector de Evaluaciones Asignadas (si hay más de una) */}
      {availableEvals.length > 1 && (
        <div className="field-eval-selector">
          <label htmlFor="eval-select">
            <span className="material-symbols-outlined">assignment</span>
            Assigned Assessment:
          </label>
          <select
            id="eval-select"
            value={selectedEvalId || ''}
            onChange={(e) => setSelectedEvalId(Number(e.target.value))}
          >
            {availableEvals.map((e) => (
              <option key={e.evaluationId} value={e.evaluationId}>
                #{e.evaluationId} — {e.institution?.name || 'Facility'} ({e.status}) — {e.technician?.person?.name || 'Evaluator not assigned'} — {new Date(e.scheduledDate).toLocaleDateString('en-US')}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 2. Top Hero Panel de la Inspección Activa */}
      <div className="field-hero-panel">
        <div>
          <div className="hero-meta-strip">
            <span className={`hero-badge ${started ? 'active' : 'case'}`}>
              {recordStatus === 'EN_CORRECCION' ? 'Returned for correction' : finished ? 'Finished Assessment' : started ? 'Inspection in Progress' : 'Scheduled'}
            </span>
            <span className="hero-badge case">Record #{activeItem.evaluationId}</span>
            <span className="hero-badge version">{template?.name || 'Official GMP form'}</span>
          </div>
          <h1>{activeItem.institution?.name || 'Facility under Audit'}</h1>
          <div className="hero-details-row">
            {(activeItem.institution as any)?.rnc && (
              <span className="hero-detail">
                <span className="material-symbols-outlined">badge</span>
                RNC: {(activeItem.institution as any).rnc}
              </span>
            )}
            {(activeItem.institution as any)?.streetName && (
              <span className="hero-detail">
                <span className="material-symbols-outlined">pin_drop</span>
                {(activeItem.institution as any).streetName}
              </span>
            )}
            <span className="hero-detail">
              <span className="material-symbols-outlined">person</span>
              Evaluator: {(activeItem as any).technician?.person?.name || 'Not assigned'}
            </span>
            <span className="hero-detail">
              <span className="material-symbols-outlined">event</span>
              {new Date(activeItem.scheduledDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        {recordStatus === 'EN_CORRECCION' && (
          <div className="correction-banner" role="status">
            <h2>1. Review feedback</h2>
            <p>
              {correction?.scope === 'COMPLETA' || correction?.status === 'DEVUELTO'
                ? 'The coordinator returned this same evaluation for a full resubmission. Your answers, evidence, and notes are still here.'
                : 'The coordinator returned this same evaluation. Edit only the flagged sections. The rest stays as submitted.'}
            </p>
            {correction?.comments && (
              <ol>
                {String(correction.comments).split(/\n+/).filter((line) => line.trim()).map((line) => (
                  <li key={line}>{line.trim()}</li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* 3. Live Dynamic Risk Engine Widget (RF-14) */}
        <div className="field-risk-widget">
          <div className="risk-widget-head">
            <span className="risk-widget-title">
              <span className="material-symbols-outlined">speed</span>
              Dynamic Risk Engine (RF-14)
            </span>
            <span className={`risk-badge ${liveRisk.level.toLowerCase()}`}>
              {liveRisk.level === 'BAJO'
                ? 'LOW RISK'
                : liveRisk.level === 'MEDIO'
                ? 'MEDIUM RISK'
                : 'HIGH RISK'}
            </span>
          </div>

          <div className="risk-metrics-grid">
            <div className="risk-metric-box">
              <span className="risk-metric-label">GMP Compliance</span>
              <div className="risk-metric-val">
                <strong>{liveRisk.percent}</strong>
                <span>%</span>
              </div>
              <div className="risk-progress-bar">
                <div
                  className={`risk-progress-fill ${liveRisk.level.toLowerCase()}`}
                  style={{ width: `${Math.min(100, Math.max(5, liveRisk.percent))}%` }}
                />
              </div>
            </div>

            <div className="risk-metric-box">
              <span className="risk-metric-label">Cumulative RBA Index</span>
              <div className="risk-metric-val">
                <strong>{liveRisk.riskScore}</strong>
                <span>/ 10.0</span>
              </div>
              <span className="risk-frequency-note">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                  calendar_clock
                </span>
                Freq: {liveRisk.frequency.toLowerCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Modal de Inicialización si aún no se ha iniciado */}
      {!started && (
        <section className="field-start-modal">
          <div className="hero-meta-strip">
            <span className="hero-badge active">Required Step</span>
          </div>
          <h2>Confirm Plant Visit Data</h2>
          <p>
            Select the facility representative accompanying the inspection and the main food item subject to the assessment according to RF-12.
          </p>

          <div className="start-fields-grid">
            <label>
              Present Plant Representative
              <select
                value={representId}
                onChange={(e) => setRepresentId(e.target.value)}
              >
                <option value="">Select Representative</option>
                {representatives.map((rep) => (
                  <option key={rep.representId} value={rep.representId}>
                    {rep.person?.name || `Representative #${rep.representId}`} ({rep.type})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Food Category
              <select
                defaultValue=""
                onChange={(e) => void chooseCategory(e.target.value)}
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.categoryId} value={cat.categoryId}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              Specific Food Item
              <select
                value={foodId}
                onChange={(e) => setFoodId(e.target.value)}
                disabled={!foods.length}
              >
                <option value="">
                  {foods.length ? 'Select Food Item' : 'Select a category first'}
                </option>
                {foods.map((food) => (
                  <option key={food.foodId} value={food.foodId}>
                    {food.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            className="btn-finish-inspection"
            style={{ width: '100%', marginTop: '10px' }}
            disabled={busy || !representId || !foodId}
            onClick={() => void startAssessment()}
          >
            <span className="material-symbols-outlined">play_arrow</span>
            Start Good Practices Assessment →
          </button>
        </section>
      )}

      {/* Resumen al Finalizar */}
      {finishSummary && (
        <div className="notice" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', marginBottom: '20px' }}>
          <div>
            <strong>Assessment finished and verdict successfully issued!</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
              Score: {finishSummary.score?.puntajeObtenido} | Compliance: {finishSummary.score?.porcentajeCumplimiento}% | Risk Level: <b>{statusLabel(finishSummary.score?.nivelRiesgo)}</b> | Inspection Frequency: <b>{statusLabel(finishSummary.score?.frecuenciaInspeccion)}</b>. The case has moved to Coordinator review.
            </p>
          </div>
        </div>
      )}

      {/* 5. Estructura Principal: Árbol de Capítulos Sanitarios y Preguntas */}
      <div className="assessment-layout">
        {/* Barra lateral de Capítulos BPM */}
        <aside className="chapters-sidebar">
          <div className="chapters-header">
            <span className="chapters-title">GMP Sanitary Chapters</span>
            <span className="chapters-count-badge">
              {completeness.answeredQuestions}/{completeness.requiredQuestions}
            </span>
          </div>

          <div className="form-progress-panel">
            <strong>Total progress: {completeness.percent}%</strong>
            <p>
              {completeness.answeredQuestions} of {completeness.requiredQuestions} required criteria
              {completeness.caseLabel ? ` for ${completeness.caseLabel}` : ''}.
            </p>
            <ul>
              {chapters.filter((ch) => ch.status !== 'not_applicable').map((ch) => (
                <li key={ch.h1Id}>
                  <span>{ch.name}</span>
                  <b>
                    {ch.status === 'complete' ? 'Complete' : ch.status === 'exempt' ? 'N/A' : 'Incomplete'}
                    {' '}
                    {ch.answered}/{ch.required}
                  </b>
                </li>
              ))}
            </ul>
            {chapters.some((ch) => ch.status === 'not_applicable') && (
              <p className="form-na-note">
                Not required for this case:{' '}
                {chapters.filter((ch) => ch.status === 'not_applicable').map((ch) => ch.name).join(', ')}.
              </p>
            )}
          </div>

          <nav className="chapters-list" aria-label="GMP Form Structure">
            {chapters.map((ch) => {
              const isComplete = ch.status === 'complete' || ch.status === 'exempt'
              const isNa = ch.status === 'not_applicable'
              const isActive = ch.h1Id === activeChapter?.h1Id

              return (
                <button
                  key={ch.h1Id}
                  type="button"
                  className={`chapter-nav-btn ${isActive ? 'active' : ''} ${isComplete ? 'done' : ''} ${isNa ? 'na' : ''} ${ch.status === 'incomplete' ? 'incomplete' : ''}`}
                  onClick={() => setActiveChapterId(ch.h1Id)}
                >
                  <div className="chapter-btn-left">
                    <span className="material-symbols-outlined">
                      {ch.status === 'complete' ? 'check_circle' : isNa || ch.status === 'exempt' ? 'block' : isActive ? 'timelapse' : 'folder'}
                    </span>
                    <span className="chapter-btn-text">
                      {ch.name}
                    </span>
                  </div>
                  <span className="chapter-stat-badge">
                    {isNa || ch.status === 'exempt' ? 'N/A' : `${ch.answered}/${ch.required}`}
                  </span>
                </button>
              )
            })}
          </nav>

          {activeChapter && (
            <div className="block-summary-card">
              <span className="block-summary-title">Current Chapter Summary</span>
              <div className="block-summary-row">
                <span>Assessed:</span>
                <strong>
                  {activeChapter.status === 'not_applicable'
                    ? 'N/A'
                    : `${activeChapter.answered} of ${activeChapter.required}`}
                </strong>
              </div>
              <div className="block-summary-row">
                <span>Non-Conformities (NC):</span>
                <span className="block-nc-badge">
                  {activeChapter.questions.filter((q) => answers[q.key] === 'NC').length} findings
                </span>
              </div>
            </div>
          )}
        </aside>

        {/* Lienzo de Preguntas del Capítulo Activo */}
        <div className="questions-deck">
          {activeChapter?.status === 'not_applicable' ? (
            <div className="empty">
              {activeChapter.skipReason === 'outside_case_scope'
                ? `${activeChapter.name} is not part of the form for this request type, so it is not required.`
                : `${activeChapter.name} has no active criteria in the assigned form.`}
            </div>
          ) : activeChapter ? (
            activeChapter.questions.map((question) => {
              const currentVal = answers[question.key]
              const isNC = currentVal === 'NC'
              const isCP = currentVal === 'CP'
              const qEvidences = evidences.filter((e: any) => {
                if (question.askType === 'h1') return e.h1AskId === question.askId
                if (question.askType === 'h2') return e.h2AskId === question.askId
                if (question.askType === 'h3') return e.h3AskId === question.askId
                if (question.askType === 'h4') return e.h4AskId === question.askId
                return false
              })
              const editable = questionIsEditable(question)
              const readOnly = !started || finished || busy || !editable

              return (
                <article
                  key={question.key}
                  className={`criteria-card ${isNC ? 'has-nc' : isCP ? 'has-cp' : ''} ${editable ? '' : 'is-locked'}`}
                >
                  <div className="criteria-head">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className="criteria-num-tag">{question.codeLabel}</span>
                      <span className="criteria-sectionName criteria-section-name">
                        {question.sectionName}
                      </span>
                    </div>

                    {(isNC || isCP) && (
                      <mark className={isNC ? 'high' : 'medium'}>
                        {isNC ? 'Non-Conformity' : 'RBA Observation'}
                      </mark>
                    )}
                  </div>

                  <p className="criteria-question-text">{question.txt}</p>
                  {!editable && recordStatus === 'EN_CORRECCION' && (
                    <p className="ops-help">This section was not flagged. It stays as submitted.</p>
                  )}

                  {/* Segmented Decision Buttons */}
                  <div className="decision-buttons-grid">
                    <button
                      type="button"
                      className={`decision-btn c ${currentVal === 'C' ? 'active' : ''}`}
                      disabled={readOnly}
                      onClick={() => handleAnswerChange(question, 'C')}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        check_circle
                      </span>
                      [ C ] Complies
                    </button>

                    <button
                      type="button"
                      className={`decision-btn cp ${currentVal === 'CP' ? 'active' : ''}`}
                      disabled={readOnly}
                      onClick={() => handleAnswerChange(question, 'CP')}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        error
                      </span>
                      [ CP ] Partial
                    </button>

                    <button
                      type="button"
                      className={`decision-btn nc ${currentVal === 'NC' ? 'active' : ''}`}
                      disabled={readOnly}
                      onClick={() => handleAnswerChange(question, 'NC')}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        cancel
                      </span>
                      [ NC ] Does Not Comply
                    </button>

                    <button
                      type="button"
                      className={`decision-btn na ${currentVal === 'N/A' ? 'active' : ''}`}
                      disabled={readOnly}
                      onClick={() => handleAnswerChange(question, 'N/A')}
                    >
                      [ N/A ] Exempt
                    </button>
                  </div>

                  {/* Observación Técnica por Criterio */}
                  {(isNC || isCP || notes[question.key] !== undefined) && (
                    <div className="criteria-obs-panel">
                      <label className={`criteria-obs-label ${isNC || isCP ? 'warn' : ''}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          edit_note
                        </span>
                        {isNC
                          ? 'Mandatory Technical Observation (Non-Conformity Finding)'
                          : isCP
                          ? 'Partial Compliance Detail'
                          : 'Assessor Note'}
                      </label>
                      <textarea
                        className="criteria-obs-textarea"
                        placeholder="Document the technical evidence or finding observed on-site..."
                        value={notes[question.key] || ''}
                        disabled={readOnly}
                        onChange={(e) => handleNoteChange(question.key, e.target.value)}
                      />
                    </div>
                  )}

                  {/* Captura de Evidencias Georreferenciadas (RF-15) */}
                  <div className="criteria-evidences-deck">
                    <div className="evidences-deck-head">
                      <span className="evidences-deck-title">
                        <span className="material-symbols-outlined">photo_camera</span>
                        Photographic / Documentary Evidence (RF-15)
                      </span>
                      <span className="evidences-deck-counter">
                        {qEvidences.length} file(s)
                      </span>
                    </div>

                    <div className="evidences-list-row">
                      {qEvidences.map((ev) => (
                        <div key={ev.evidenceId} className="evidence-thumb-card">
                          <span className="material-symbols-outlined">
                            {ev.type === 'FOTO' ? 'image' : ev.type === 'VIDEO' ? 'videocam' : 'description'}
                          </span>
                          <div className="evidence-thumb-info">
                            <span className="evidence-thumb-name">
                              {ev.url ? ev.url.split('/').pop() : `Evidence #${ev.evidenceId}`}
                            </span>
                            {ev.latitude !== null && ev.latitude !== undefined && (
                              <span className="evidence-thumb-geo">
                                <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>
                                  location_on
                                </span>
                                GPS: {ev.latitude.toFixed(3)}°, {ev.longitude?.toFixed(3)}°
                              </span>
                            )}
                          </div>
                          {editable && !finished && (
                            <button
                              type="button"
                              className="evidence-del-btn"
                              title="Remove evidence"
                              onClick={() => void deleteEvidence(ev.evidenceId)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                delete
                              </span>
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Botón de captura con input de archivo oculto */}
                      {editable && !finished && (
                        <label className="evidence-upload-btn-label">
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                            add_a_photo
                          </span>
                          + Capture Photo / File (Auto GPS)
                          <input
                            type="file"
                            accept="image/*,video/*,.pdf,.doc,.docx"
                            disabled={readOnly}
                            ref={(el) => (uploadInputRefs.current[question.key] = el)}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                void handleUploadEvidenceForQuestion(question, file)
                                e.target.value = ''
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="empty">Select a sanitary chapter to begin the assessment.</div>
          )}
        </div>
      </div>

      {/* 6. Barra Flotante Fija Inferior (Sticky Action Bar) */}
      <div className="field-floating-bar">
        {started && !finished && completeness.blockReason && (
          <p className="form-block-reason" role="status">{completeness.blockReason}</p>
        )}
        <div className="floating-bar-left">
          <button
            type="button"
            className="btn-draft-save"
            disabled={!started || finished || busy}
            onClick={() => void saveDraft()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              save
            </span>
            Save Draft {isOnline ? 'on Server' : 'on Device (Offline)'}
          </button>

          {pendingSyncCount > 0 && isOnline && (
            <button
              type="button"
              className="btn-sync-pending"
              disabled={busy}
              onClick={() => void checkAndFlushSyncQueue()}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                cloud_sync
              </span>
              Sync Pending ({pendingSyncCount})
            </button>
          )}

          {lastSavedTime && (
            <span className="auto-save-time hidden sm:inline">
              Last saved: {lastSavedTime}
            </span>
          )}
        </div>

        <div className="floating-bar-right">
          {onViewReport && (
            <button
              type="button"
              className="btn-finish-inspection"
              style={{ background: '#0d3894', color: '#fff' }}
              title={
                recordStatus === 'EN_CORRECCION'
                  ? 'Preview the verdict that resubmitting will send to the coordinator'
                  : finished
                    ? 'View the verdict currently on record for the coordinator'
                    : 'Preview the verdict from the answers currently on this assessment'
              }
              onClick={() => onViewReport(activeItem.evaluationId, packAnswers())}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                description
              </span>
              View Official Verdict (PDF)
            </button>
          )}

          {recordStatus === 'EN_CORRECCION' ? (
            <button
              type="button"
              className="btn-finish-inspection"
              disabled={busy}
              onClick={() => void resubmitCorrection()}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                send
              </span>
              Resubmit evaluation
            </button>
          ) : (
            <button
              type="button"
              className="btn-finish-inspection"
              disabled={!started || finished || busy || !completeness.canSubmit}
              onClick={() => void finishAssessment()}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                calculate
              </span>
              Finish and Calculate Final Risk (RF-14 / RF-16)
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
