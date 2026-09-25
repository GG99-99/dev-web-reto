// @ts-nocheck
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import type { AskValue, FormTemplateTree, Evidence, FormAnswers } from '@reto/shared'
import {
  catalogsService,
  evidencesService,
  formExecutionService,
  institutionsService,
  evaluationsService,
  offlineStorage,
} from './services'
import type { Evaluation } from './App'
import './App.css'
import './FieldAssessment.css'

type LiveFieldProps = {
  items?: Evaluation[]
  item?: Evaluation
  live: boolean
  inform: (message: string) => void
  onViewReport?: (evaluationId: number) => void
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
  evaluation?.status === 'EN_PROCESO'

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

function buildStructuredChapters(template: FormTemplateTree | null): ChapterGroup[] {
  if (!template || !template.h1s) return []
  const chapters: ChapterGroup[] = []

  template.h1s.forEach((h1, h1Idx) => {
    const chapterQuestions: StructuredQuestion[] = []
    let qCounter = 1
    const chapterPrefix = `${h1Idx + 1}`

    // Preguntas directas de H1
    for (const ask of h1.h1Asks ?? []) {
      chapterQuestions.push({
        key: `h1_ask:${ask.h1AskId}`,
        txt: ask.name,
        h1Id: h1.h1Id,
        chapterName: h1.name,
        sectionName: h1.name,
        codeLabel: `${chapterPrefix}.${qCounter++}`,
        askType: 'h1',
        askId: ask.h1AskId,
      })
    }

    // Subniveles H2, H3, H4
    for (const h2 of h1.h2s ?? []) {
      for (const ask of h2.h2Asks ?? []) {
        chapterQuestions.push({
          key: `h2_ask:${ask.h2AskId}`,
          txt: ask.name,
          h1Id: h1.h1Id,
          chapterName: h1.name,
          sectionName: h2.name,
          codeLabel: `${chapterPrefix}.${qCounter++}`,
          askType: 'h2',
          askId: ask.h2AskId,
        })
      }

      for (const h3 of h2.h3s ?? []) {
        for (const ask of h3.h3Asks ?? []) {
          chapterQuestions.push({
            key: `h3_ask:${ask.h3AskId}`,
            txt: ask.name,
            h1Id: h1.h1Id,
            chapterName: h1.name,
            sectionName: `${h2.name} / ${h3.name}`,
            codeLabel: `${chapterPrefix}.${qCounter++}`,
            askType: 'h3',
            askId: ask.h3AskId,
          })
        }

        for (const h4 of h3.h4s ?? []) {
          for (const ask of h4.h4Asks ?? []) {
            chapterQuestions.push({
              key: `h4_ask:${ask.h4AskId}`,
              txt: ask.name,
              h1Id: h1.h1Id,
              chapterName: h1.name,
              sectionName: `${h2.name} / ${h4.name}`,
              codeLabel: `${chapterPrefix}.${qCounter++}`,
              askType: 'h4',
              askId: ask.h4AskId,
            })
          }
        }
      }
    }

    chapters.push({
      h1Id: h1.h1Id,
      name: h1.name,
      codePrefix: chapterPrefix,
      questions: chapterQuestions,
    })
  })

  return chapters
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
  const [activeChapterId, setActiveChapterId] = useState<number | null>(null)
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

  // Cargar plantilla BPM (con caché offline)
  useEffect(() => {
    let cancelled = false
    async function loadTemplate() {
      // Intentar primero desde caché local
      const cached = await offlineStorage.getCachedTemplateTree(1)
      if (cancelled) return
      if (cached) {
        setTemplate(cached)
        if (cached.h1s && cached.h1s.length > 0) {
          setActiveChapterId((prev) => prev ?? cached.h1s[0].h1Id)
        }
      } else {
        setTemplate((current) => current ?? offlineStorage.DEFAULT_BPM_TEMPLATE)
      }

      // Si hay red, refrescar plantilla y actualizar caché
      if (isOnline) {
        try {
          const res = await formExecutionService.getTemplateTree(1)
          if (!cancelled && res.valid) {
            setTemplate(res.data)
            await offlineStorage.saveCachedTemplateTree(res.data)
            if (res.data.h1s && res.data.h1s.length > 0) {
              setActiveChapterId((prev) => prev ?? res.data.h1s[0].h1Id)
            }
          }
        } catch {
          // Si falla, el caché local ya fue cargado
        }
      }
    }

    void loadTemplate()
    return () => { cancelled = true }
  }, [isOnline])

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
      setFinished(activeItem.status === 'FINALIZADA')
      setStarted(
        activeItem.status === 'EN_PROCESO' ||
        activeItem.status === 'FINALIZADA' ||
        startedLocally.current.has(evalId),
      )
    }

    async function hydrateEvaluation() {
      const localDraft = await offlineStorage.getLocalDraft(evalId)
      if (cancelled) return

      const startedNow =
        activeItem.status === 'EN_PROCESO' ||
        activeItem.status === 'FINALIZADA' ||
        Boolean(localDraft?.started) ||
        startedLocally.current.has(evalId)
      const finishedNow = activeItem.status === 'FINALIZADA' || Boolean(localDraft?.finished)
      setStarted(startedNow)
      setFinished(finishedNow)
      if (startedNow) startedLocally.current.add(evalId)

      if (localDraft) {
        const answerObj: AnswerMap = {}
        localDraft.answers.forEach((a) => {
          answerObj[a.key] = a.value
        })
        setAnswers((current) => ({ ...answerObj, ...current }))
        setNotes((current) => ({ ...(localDraft.notes || {}), ...current }))
        if (localDraft.updatedAt) {
          setLastSavedTime(new Date(localDraft.updatedAt).toLocaleTimeString())
        }
      }

      if (isOnline) {
        try {
          const detailRes = await evaluationsService.getById(evalId)
          if (!cancelled && detailRes.valid) {
            const data = detailRes.data as any
            if (data.status === 'EN_PROCESO' || data.status === 'FINALIZADA') {
              setStarted(true)
              startedLocally.current.add(evalId)
            }
            if (data.status === 'FINALIZADA') {
              setFinished(true)
            }

            if (data.formResponse?.answers && Array.isArray(data.formResponse.answers)) {
              setAnswers((current) => {
                const merged = { ...current }
                data.formResponse.answers.forEach((ans: any) => {
                  if (ans && ans.key && ans.value && merged[ans.key] === undefined) {
                    merged[ans.key] = ans.value
                  }
                })
                return merged
              })
            }

            if (Array.isArray(data.evidences)) {
              setEvidences(data.evidences)
            }
          }

          const evRes = await evidencesService.listByEvaluation(evalId)
          if (!cancelled && evRes.valid) {
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

  // Estructuración jerárquica de capítulos
  const chapters = useMemo(() => buildStructuredChapters(template), [template])

  // Capítulo actualmente seleccionado
  const activeChapter = useMemo(() => {
    if (!chapters.length) return null
    return chapters.find((c) => c.h1Id === activeChapterId) ?? chapters[0]
  }, [chapters, activeChapterId])

  // Todas las preguntas aplanadas para cómputos globales
  const allQuestions = useMemo(() => {
    return chapters.flatMap((c) => c.questions)
  }, [chapters])

  // Motor de Riesgo Dinámico en vivo
  const liveRisk = useMemo(() => calculateLiveRisk(answers), [answers])

  // Manejador para responder un criterio
  const handleAnswerChange = useCallback(
    (question: StructuredQuestion, value: AskValue) => {
      if (!started || finished || busy) return

      const updatedAnswers: AnswerMap = { ...answers, [question.key]: value }
      setAnswers(updatedAnswers)

      // Guardar inmediatamente en almacenamiento local (IndexedDB + localStorage)
      if (activeItem) {
        const answersList: FormAnswers = Object.entries(updatedAnswers).map(([k, v]) => {
          const qObj = allQuestions.find((q) => q.key === k)
          return { key: k, txt: qObj?.txt || '', value: v }
        })
        void offlineStorage.saveLocalDraft(activeItem.evaluationId, answersList, notes, { started: true })
        setLastSavedTime(new Date().toLocaleTimeString())
      }
    },
    [started, finished, busy, answers, activeItem, allQuestions, notes]
  )

  // Manejador para cambiar nota técnica de un criterio
  const handleNoteChange = useCallback(
    (questionKey: string, text: string) => {
      const updatedNotes = { ...notes, [questionKey]: text }
      setNotes(updatedNotes)

      if (activeItem) {
        const answersList: FormAnswers = Object.entries(answers).map(([k, v]) => {
          const qObj = allQuestions.find((q) => q.key === k)
          return { key: k, txt: qObj?.txt || '', value: v }
        })
        void offlineStorage.saveLocalDraft(activeItem.evaluationId, answersList, updatedNotes, { started: true })
      }
    },
    [notes, activeItem, answers, allQuestions]
  )

  // Guardar borrador en el backend (o encolar si offline)
  const saveDraft = async () => {
    if (!activeItem) return
    setBusy(true)

    const answersList: FormAnswers = allQuestions
      .filter((q) => answers[q.key] !== undefined)
      .map((q) => ({
        key: q.key,
        txt: q.txt,
        value: answers[q.key],
      }))

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
      const answersList: FormAnswers = allQuestions
        .filter((q) => answers[q.key] !== undefined)
        .map((q) => ({ key: q.key, txt: q.txt, value: answers[q.key] }))
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
    if (liveRisk.totalAnswered === 0) {
      inform('You must answer applicable criteria before finishing the assessment.')
      return
    }

    if (!confirm('Are you sure you want to finish this assessment? Answers will be locked and the technical report will be issued.')) {
      return
    }

    setBusy(true)
    try {
      // Guardar últimas respuestas primero
      const answersList: FormAnswers = allQuestions
        .filter((q) => answers[q.key] !== undefined)
        .map((q) => ({ key: q.key, txt: q.txt, value: answers[q.key] }))

      await formExecutionService.saveAnswers(activeItem.evaluationId, { answers: answersList })

      const res = await formExecutionService.finish(activeItem.evaluationId)
      if (!res.valid) {
        inform(res.error.message)
        return
      }

      setFinished(true)
      setFinishSummary(res.data)
      inform(`Assessment finished! Determined risk level: ${res.data.score.nivelRiesgo}.`)
    } catch (err: any) {
      inform(err?.response?.data?.message || 'Could not finish the assessment.')
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
      {/* 1. Sub-barra PWA Offline & Estado del Dispositivo */}
      <div className="field-sync-bar">
        <div className="sync-status-group">
          <span
            className={`sync-pulse-dot ${
              busy ? 'syncing' : isOnline ? 'online' : 'offline'
            }`}
          />
          <div>
            <div className="sync-title">
              {isOnline ? 'Online PWA Engine • Synchronized' : 'PWA Offline Mode Active (IndexedDB)'}
            </div>
            <div className="sync-subtext">
              <span>{liveRisk.totalAnswered} locally cached answers</span>
              {pendingSyncCount > 0 && (
                <mark className="high">
                  {pendingSyncCount} pending sync
                </mark>
              )}
            </div>
          </div>
        </div>

        <div className="sync-device-telemetry">
          {gps && (
            <div className="telemetry-item" title="Location captured by GPS">
              <span className="material-symbols-outlined">near_me</span>
              <span>GPS: {gps.lat.toFixed(4)}°, {gps.lng.toFixed(4)}°</span>
            </div>
          )}
          {lastSavedTime && (
            <div className="telemetry-item" title="Last saved time">
              <span className="material-symbols-outlined">save</span>
              <span>Saved: {lastSavedTime}</span>
            </div>
          )}
          <div className="telemetry-item" title="IndexedDB Storage">
            <span className="material-symbols-outlined">database</span>
            <span>IndexedDB v1</span>
          </div>
        </div>
      </div>

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
                #{e.evaluationId} — {e.institution?.name || 'Facility'} ({e.status}) — {new Date(e.scheduledDate).toLocaleDateString('en-US')}
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
              {finished ? 'Finished Assessment' : started ? 'Inspection in Progress' : 'Scheduled'}
            </span>
            <span className="hero-badge case">Record #{activeItem.evaluationId}</span>
            <span className="hero-badge version">GMP Form 2026</span>
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
              Score: {finishSummary.score?.puntajeObtenido} | Compliance: {finishSummary.score?.porcentajeCumplimiento}% | Risk Level: <b>{finishSummary.score?.nivelRiesgo}</b> | Inspection Frequency: <b>{finishSummary.score?.frecuenciaInspeccion}</b>. The case has moved to Coordinator review.
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
              {chapters.length} Chapters
            </span>
          </div>

          <nav className="chapters-list" aria-label="GMP Form Structure">
            {chapters.map((ch, idx) => {
              const chQuestions = ch.questions
              const answeredCount = chQuestions.filter((q) => answers[q.key] !== undefined).length
              const totalCount = chQuestions.length
              const isComplete = totalCount > 0 && answeredCount === totalCount
              const pct = totalCount ? Math.round((answeredCount / totalCount) * 100) : 0
              const isActive = ch.h1Id === activeChapter?.h1Id

              return (
                <button
                  key={ch.h1Id}
                  type="button"
                  className={`chapter-nav-btn ${isActive ? 'active' : ''} ${isComplete ? 'done' : ''}`}
                  onClick={() => setActiveChapterId(ch.h1Id)}
                >
                  <div className="chapter-btn-left">
                    <span className="material-symbols-outlined">
                      {isComplete ? 'check_circle' : isActive ? 'timelapse' : 'folder'}
                    </span>
                    <span className="chapter-btn-text">
                      {idx + 1}. {ch.name}
                    </span>
                  </div>
                  <span className="chapter-stat-badge">
                    {pct === 100 ? '100%' : `${answeredCount}/${totalCount}`}
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
                  {activeChapter.questions.filter((q) => answers[q.key] !== undefined).length} de {activeChapter.questions.length}
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
          {activeChapter ? (
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

              return (
                <article
                  key={question.key}
                  className={`criteria-card ${isNC ? 'has-nc' : isCP ? 'has-cp' : ''}`}
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

                  {/* Segmented Decision Buttons */}
                  <div className="decision-buttons-grid">
                    <button
                      type="button"
                      className={`decision-btn c ${currentVal === 'C' ? 'active' : ''}`}
                      disabled={!started || finished || busy}
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
                      disabled={!started || finished || busy}
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
                      disabled={!started || finished || busy}
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
                      disabled={!started || finished || busy}
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
                        disabled={!started || finished || busy}
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
                          {!finished && (
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
                      {!finished && (
                        <label className="evidence-upload-btn-label">
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                            add_a_photo
                          </span>
                          + Capture Photo / File (Auto GPS)
                          <input
                            type="file"
                            accept="image/*,video/*,.pdf,.doc,.docx"
                            disabled={!started || finished || busy}
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
              onClick={() => onViewReport(activeItem.evaluationId)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                description
              </span>
              View Official Verdict (PDF)
            </button>
          )}

          <button
            type="button"
            className="btn-finish-inspection"
            disabled={!started || finished || busy || liveRisk.totalAnswered === 0}
            onClick={() => void finishAssessment()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              calculate
            </span>
            Finish and Calculate Final Risk (RF-14 / RF-16)
          </button>
        </div>
      </div>
    </section>
  )
}
